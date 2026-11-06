"""Render the completed Task 10 measurements; never estimates an unmeasured rating."""
import json
import sys
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle


def main(folder):
    root = Path(folder)
    boards = json.loads((root / "boards.json").read_text(encoding="utf-8"))
    boards = [b for b in boards if not b.get("fail") and b.get("family") and b.get("skilled")]
    stories = sorted({b["brief"]["story"] for b in boards})
    fig, ax = plt.subplots(figsize=(11.5, 7.5))
    ax.add_patch(Rectangle((10, 2.5), 3, 3.5, facecolor="#bfe5c5", edgecolor="#26723a", alpha=0.7))
    ax.text(11.5, 6.35, "target band", ha="center", fontsize=10, color="#26723a")
    colors = plt.get_cmap("tab10")
    for i, story in enumerate(stories):
        rows = [b for b in boards if b["brief"]["story"] == story]
        ax.scatter([b["family"]["exp"] for b in rows], [b["skilled"]["exp"] for b in rows],
                   s=35, alpha=0.65, color=colors(i), label=rows[0]["card"]["story"], edgecolors="none")
    hits = [b for b in boards if 10 <= b["family"]["exp"] <= 13 and 2.5 <= b["skilled"]["exp"] <= 6]
    if hits:
        ax.scatter([b["family"]["exp"] for b in hits], [b["skilled"]["exp"] for b in hits],
                   s=75, facecolors="none", edgecolors="#183924", linewidths=1.3)
    ax.set(xlim=(0.5, 20.6), ylim=(0.5, 20.6), xlabel="Family bot: capped expected tries",
           ylabel="Skilled bot: capped expected tries", title="Builder v2: where the studied boards land")
    ax.set_xticks([1, 5, 10, 13, 15, 20])
    ax.set_yticks([1, 2.5, 6, 10, 15, 20])
    ax.grid(alpha=0.18)
    ax.set_axisbelow(True)
    ax.legend(loc="upper left", bbox_to_anchor=(1.01, 1), frameon=False, fontsize=9)
    fig.text(0.09, 0.02, f"{len(boards)} fully rated boards; {len(hits)} in both bands. Exact points, without jitter. 20 is the retry cap.\n"
             "Knob and range experiments; these are not qualified player levels.", fontsize=9, color="#444444")
    fig.tight_layout(rect=(0, 0.07, 1, 1))
    fig.savefig(root / "range.png", dpi=170, facecolor="white")
    plt.close(fig)


if __name__ == "__main__":
    main(sys.argv[1])
