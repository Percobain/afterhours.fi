"""Chart style: validated categorical palette (dataviz reference instance), thin marks, recessive grid."""
import os
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

CAT = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"]
SEQ = ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#1c5cab", "#104281", "#0d366b"]
STATUS = {"good": "#0ca30c", "warning": "#fab219", "serious": "#ec835a", "critical": "#d03b3b"}
DIV_NEG, DIV_MID, DIV_POS = "#e34948", "#f0efec", "#2a78d6"
SURFACE = "#fcfcfb"; INK = "#0b0b0b"; INK2 = "#52514e"; GRID = "#e6e5e1"
HERMEE = CAT[4]   # magenta - the Sleeper
KIP = CAT[0]      # blue - the Keeper

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CHARTS = os.path.join(ROOT, "charts"); os.makedirs(CHARTS, exist_ok=True)

plt.rcParams.update({
    "figure.facecolor": SURFACE, "axes.facecolor": SURFACE, "savefig.facecolor": SURFACE,
    "axes.edgecolor": GRID, "axes.labelcolor": INK2, "xtick.color": INK2, "ytick.color": INK2,
    "text.color": INK, "axes.grid": True, "grid.color": GRID, "grid.linewidth": 0.6,
    "axes.spines.top": False, "axes.spines.right": False, "axes.spines.left": False,
    "axes.titleweight": "semibold", "axes.titlesize": 12, "axes.titlelocation": "left",
    "font.size": 9.5, "legend.frameon": False, "lines.linewidth": 2, "axes.prop_cycle": matplotlib.cycler(color=CAT),
})

def save(fig, name, note=None):
    if note:
        fig.text(0.01, 0.005, note, fontsize=7.5, color=INK2, ha="left", va="bottom")
    fp = os.path.join(CHARTS, name)
    fig.savefig(fp, dpi=150, bbox_inches="tight"); plt.close(fig)
    print("  chart ->", os.path.relpath(fp, ROOT))
    return fp

def pct(ax, axis="y", decimals=0):
    from matplotlib.ticker import PercentFormatter
    (ax.yaxis if axis == "y" else ax.xaxis).set_major_formatter(PercentFormatter(1.0, decimals=decimals))

def bp(ax, axis="y"):
    from matplotlib.ticker import FuncFormatter
    (ax.yaxis if axis == "y" else ax.xaxis).set_major_formatter(FuncFormatter(lambda v, _: f"{v*1e4:.0f}bp"))

def money(ax, axis="y"):
    from matplotlib.ticker import FuncFormatter
    (ax.yaxis if axis == "y" else ax.xaxis).set_major_formatter(FuncFormatter(lambda v, _: f"${v/1e3:,.0f}k" if abs(v) >= 1e3 else f"${v:,.0f}"))
