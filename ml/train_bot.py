"""
train_bot.py — Pipeline de treinamento do bot para Operação Atlântico Sul

Execução:
    python ml/train_bot.py

Saída:
    ml/models/move_net.onnx    — modelo de movimentação
    ml/models/attack_net.onnx  — modelo de combate

Requisitos: pip install -r ml/requirements.txt
"""

import json, pathlib, sys
import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader, random_split

# ── Configuração ──────────────────────────────────────────────────────────────

LOG_DIR    = pathlib.Path(__file__).parent.parent / "data" / "game-logs"
MODEL_DIR  = pathlib.Path(__file__).parent / "models"
MODEL_DIR.mkdir(parents=True, exist_ok=True)

GRID_H, GRID_W = 10, 16
N_CHANNELS = 9          # canais de features por célula do grid
BATCH_SIZE = 64
EPOCHS     = 40
LR         = 1e-3
VAL_SPLIT  = 0.15
MIN_TURNS  = 2          # descarta partidas muito curtas

# ── 1. Carregar logs ──────────────────────────────────────────────────────────

def load_logs():
    files = list(LOG_DIR.glob("*.jsonl"))
    if not files:
        print(f"[ERRO] Nenhum arquivo .jsonl encontrado em {LOG_DIR}")
        print("       Jogue algumas partidas primeiro para gerar dados de treino.")
        sys.exit(1)

    records = []
    for f in files:
        for line in f.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line:
                records.append(json.loads(line))

    df = pd.DataFrame(records)
    print(f"[OK] {len(files)} arquivo(s) — {len(df)} eventos totais")

    # Filtra salas com partida completa e pelo menos MIN_TURNS turnos
    over = df[df.event == "game_over"]
    valid_rooms = over[over.turn >= MIN_TURNS]["room"].unique()
    df = df[df["room"].isin(valid_rooms)]
    print(f"[OK] {len(valid_rooms)} partida(s) válida(s) após filtro")
    return df

# ── 2. Converter estado em tensor (9 × 10 × 16) ──────────────────────────────

def state_to_array(state):
    """Retorna numpy array (N_CHANNELS, GRID_H, GRID_W)."""
    grid = np.zeros((N_CHANNELS, GRID_H, GRID_W), dtype=np.float32)
    for u in state["units"]:
        if u["hp"] <= 0:
            continue
        c, r = u["col"], u["row"]
        if not (0 <= c < GRID_W and 0 <= r < GRID_H):
            continue
        team_sign = 1.0 if u["team"] == "blue" else -1.0
        cat = u.get("category", "")
        fuel = u.get("fuel") or {}
        weapons = u.get("weapons") or {}

        wpn_total = sum(
            w["quantity"] for w in weapons.values()
            if isinstance(w, dict) and "quantity" in w
        )

        grid[0, r, c] = 1.0                                              # presença
        grid[1, r, c] = team_sign                                        # equipe
        grid[2, r, c] = u["hp"] / u["maxHp"] if u["maxHp"] else 0       # HP norm.
        grid[3, r, c] = float(cat == "surface")
        grid[4, r, c] = float(cat == "submarine")
        grid[5, r, c] = float(cat == "air")
        grid[6, r, c] = float(cat == "land")
        grid[7, r, c] = fuel.get("current", 1) / (fuel.get("max", 1) or 1)
        grid[8, r, c] = min(wpn_total / 20.0, 1.0)                      # armas norm.
    return grid

# ── 3. Construir datasets ─────────────────────────────────────────────────────

def build_move_samples(df):
    """Retorna lista de (X, label) onde label é o índice flat do hex de destino."""
    samples = []
    for _, row in df[df.event == "movement_committed"].iterrows():
        state = row["state"]
        moves = row.get("moves") or []
        if not isinstance(moves, list):
            continue
        X = state_to_array(state)
        for mv in moves:
            path = mv.get("path") or []
            if len(path) < 2:
                continue
            dst = path[-1]
            dc, dr = dst["col"], dst["row"]
            if not (0 <= dc < GRID_W and 0 <= dr < GRID_H):
                continue
            samples.append((X, dr * GRID_W + dc))
    print(f"[OK] {len(samples)} exemplos de movimentação")
    return samples

def build_attack_samples(df):
    """Retorna lista de (X, label) onde label é o índice flat do hex do alvo."""
    unit_pos = {}  # roomId → turn → {unitId: (col, row)}

    # Indexa posições pelo estado de attacks_declared
    samples = []
    for _, row in df[df.event == "attacks_declared"].iterrows():
        state   = row["state"]
        attacks = row.get("attacks") or []
        if not isinstance(attacks, list) or not attacks:
            continue
        X = state_to_array(state)
        pos = {u["id"]: (u["col"], u["row"]) for u in state["units"] if u["hp"] > 0}
        for atk in attacks:
            tid = atk.get("targetId")
            if tid and tid in pos:
                tc, tr = pos[tid]
                samples.append((X, tr * GRID_W + tc))
    print(f"[OK] {len(samples)} exemplos de combate")
    return samples

# ── 4. Dataset PyTorch ────────────────────────────────────────────────────────

class HexDataset(Dataset):
    def __init__(self, samples):
        self.X = torch.tensor(np.stack([s[0] for s in samples]), dtype=torch.float32)
        self.y = torch.tensor([s[1] for s in samples], dtype=torch.long)

    def __len__(self):
        return len(self.y)

    def __getitem__(self, i):
        return self.X[i], self.y[i]

# ── 5. Modelo ─────────────────────────────────────────────────────────────────

class HexNet(nn.Module):
    """CNN leve: lê o grid como imagem e produz um score por hex."""
    def __init__(self, n_channels=N_CHANNELS, grid_h=GRID_H, grid_w=GRID_W):
        super().__init__()
        self.conv = nn.Sequential(
            nn.Conv2d(n_channels, 32, kernel_size=3, padding=1), nn.ReLU(),
            nn.Conv2d(32,         64, kernel_size=3, padding=1), nn.ReLU(),
            nn.Conv2d(64,         64, kernel_size=3, padding=1), nn.ReLU(),
        )
        self.head = nn.Sequential(
            nn.Flatten(),
            nn.Linear(64 * grid_h * grid_w, 512), nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(512, grid_h * grid_w),
        )

    def forward(self, x):
        return self.head(self.conv(x))

# ── 6. Loop de treino ─────────────────────────────────────────────────────────

def train(model, train_dl, val_dl, name):
    optimizer = torch.optim.Adam(model.parameters(), lr=LR)
    criterion = nn.CrossEntropyLoss()
    scheduler = torch.optim.lr_scheduler.StepLR(optimizer, step_size=15, gamma=0.5)
    best_acc  = 0.0
    best_path = MODEL_DIR / f"{name}_best.pt"

    for epoch in range(1, EPOCHS + 1):
        model.train()
        train_loss = 0.0
        for X, y in train_dl:
            loss = criterion(model(X), y)
            optimizer.zero_grad(); loss.backward(); optimizer.step()
            train_loss += loss.item()

        model.eval()
        correct = total = 0
        with torch.no_grad():
            for X, y in val_dl:
                preds    = model(X).argmax(dim=1)
                correct += (preds == y).sum().item()
                total   += len(y)

        acc = correct / total if total else 0
        scheduler.step()

        if acc > best_acc:
            best_acc = acc
            torch.save(model.state_dict(), best_path)

        if epoch % 5 == 0 or epoch == 1:
            print(f"  Época {epoch:3d}/{EPOCHS} | loss: {train_loss/len(train_dl):.4f} | val acc: {acc:.1%}")

    print(f"  Melhor val acc: {best_acc:.1%} → {best_path}")
    model.load_state_dict(torch.load(best_path, weights_only=True))
    return model

# ── 7. Exportar ONNX ──────────────────────────────────────────────────────────

def export_onnx(model, out_path):
    model.eval()
    dummy = torch.zeros(1, N_CHANNELS, GRID_H, GRID_W)
    torch.onnx.export(
        model, dummy, str(out_path),
        input_names=["state"],
        output_names=["logits"],
        dynamic_axes={"state": {0: "batch"}},
        opset_version=17,
    )
    print(f"[OK] ONNX exportado → {out_path}")

# ── 8. Pipeline principal ─────────────────────────────────────────────────────

def run(samples, model_name):
    if not samples:
        print(f"[AVISO] Sem exemplos para '{model_name}'. Pulando.")
        return

    ds          = HexDataset(samples)
    n_val       = max(1, int(len(ds) * VAL_SPLIT))
    train_ds, val_ds = random_split(ds, [len(ds) - n_val, n_val],
                                    generator=torch.Generator().manual_seed(42))
    train_dl    = DataLoader(train_ds, batch_size=BATCH_SIZE, shuffle=True)
    val_dl      = DataLoader(val_ds,   batch_size=BATCH_SIZE)

    print(f"\n── Treinando: {model_name} ({len(train_ds)} treino / {len(val_ds)} val) ──")
    model = HexNet()
    model = train(model, train_dl, val_dl, model_name)
    export_onnx(model, MODEL_DIR / f"{model_name}.onnx")

if __name__ == "__main__":
    df              = load_logs()
    move_samples    = build_move_samples(df)
    attack_samples  = build_attack_samples(df)

    run(move_samples,   "move_net")
    run(attack_samples, "attack_net")

    print("\n✓ Treino concluído. Modelos em ml/models/")
    print("  Próximo passo: integrar os .onnx no server.js com onnxruntime-node")
