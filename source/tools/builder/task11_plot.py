"""Standalone figures from completed Task11 measurements, without changing scores."""
import json
import sys
from pathlib import Path
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt


def ladder(root, profile):
    data = json.loads((root / "ladder-summary.json").read_text(encoding="utf-8"))
    fig, axes = plt.subplots(2, 3, figsize=(13.5, 8), sharex=True, sharey=True)
    colors = {"1": "#275eae", "2": "#c76b25"}
    for ax, pair in zip(axes.flat, data["pairs"]):
        for spare, group in pair["spares"].items():
            rows = [r for r in data["rows"] if not r["fail"] and r[profile]
                    and r["cell"]["story"] == pair["story"] and r["cell"]["spare"] == int(spare)]
            unique = {r["boardKey"]: r for r in rows}.values()
            unique = list(unique)
            ax.scatter([r["actualWay"] for r in unique], [r[profile]["exp"] for r in unique],
                       s=20, alpha=0.3, color=colors[spare])
            points = group["points"]
            ax.plot([p["way"] for p in points], [p[profile] for p in points], marker="o", markersize=4,
                    color=colors[spare], label=f"spare {spare}: median")
        lo, hi = (10, 13) if profile == "family" else (2.5, 6)
        ax.axhspan(lo, hi, color="#5ba86b", alpha=0.12)
        ax.set_title(pair["story"] + " / " + pair["shape"], fontsize=10)
        ax.set(xlim=(7.6, 16.4), ylim=(0.5, 20.6))
        ax.set_xticks(range(8, 17, 2))
        ax.set_yticks([1, 5, 10, 15, 20])
        ax.grid(alpha=0.2)
    fig.suptitle(f"Readable way ladder: {profile} bot", fontsize=16)
    fig.supxlabel("Actual minimum clock moves (requested length allows ±1)", y=0.075)
    fig.supylabel("Capped expected tries")
    handles, labels = axes[0, 0].get_legend_handles_labels()
    fig.legend(handles, labels, loc="lower center", bbox_to_anchor=(0.5, 0.01), ncol=2, frameon=False)
    fig.text(0.03, 0.004, "Dots: distinct boards. Lines: medians. Placements can change with length; clock spare alone is paired. 20 is the cap.", fontsize=8, color="#444")
    fig.tight_layout(rect=(0.02, 0.1, 1, 0.95))
    fig.savefig(root / f"way-ladder-{profile}.png", dpi=165, facecolor="white")
    plt.close(fig)


def errors(root):
    rows = [json.loads(p.read_text(encoding="utf-8")) for p in sorted((root / "profiles").glob("*.json"))]
    colors = {"easy": "#387bb8", "middle": "#299566", "hard": "#c96143"}
    fig, axes = plt.subplots(1, 3, figsize=(14, 4.8), sharey=True)
    fields = [("way", "Actual clock-route length"), ("realDecisionPoints", "Live win/lose forks on stored route"),
              ("maxKeyDistance", "Maximum key-to-clock distance")]
    for ax, (field, label) in zip(axes, fields):
        for band, color in colors.items():
            values = [r for r in rows if r["band"] == band]
            ax.scatter([r["structure"][field] for r in values], [r["fullRatings"]["family"]["exp"] for r in values],
                       color=color, label=f"{band} ({len(values)})", alpha=0.6, s=32, edgecolors="none")
        ax.set_xlabel(label)
        ax.grid(alpha=0.18)
        ax.set_ylim(0.5, 20.6)
    axes[0].set_ylabel("Full family rating: capped expected tries")
    axes[-1].legend(frameon=False, loc="lower right")
    fig.suptitle("What separates the sampled easy, middle and brutal boards?", fontsize=14)
    fig.text(0.04, 0.01, "60 diagnostic boards; actual frozen-key tiles excluded. Exact points, without jitter. Fork counts with unresolved engine actions are lower bounds.", fontsize=8, color="#444")
    fig.tight_layout(rect=(0, 0.055, 1, 0.93))
    fig.savefig(root / "error-profile-comparison.png", dpi=165, facecolor="white")
    plt.close(fig)


if __name__ == "__main__":
    root = Path(sys.argv[1])
    for profile in ["family", "skilled"]:
        ladder(root, profile)
    if (root / "profiles").exists():
        errors(root)
