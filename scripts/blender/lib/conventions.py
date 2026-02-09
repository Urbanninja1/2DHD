"""Shared constants for the Blender asset pipeline."""
import os

# Project root (3 levels up from lib/)
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))

# Output directories
MODEL_OUTPUT_DIR = os.path.join(PROJECT_ROOT, 'public', 'assets', 'models', 'props', 'ironrath')
TEXTURE_OUTPUT_DIR = os.path.join(PROJECT_ROOT, 'public', 'assets', 'textures')

# Triangle budgets per category
BUDGET_SMALL = 300       # goblets, candles, plates
BUDGET_MEDIUM = 1200     # chairs, sconces, small decor
BUDGET_LARGE = 2500      # columns, thrones, tables

# Texture sizes
TEX_PROP_SMALL = 256     # small props
TEX_PROP_LARGE = 512     # large props
TEX_SURFACE = 1024       # room surfaces (floor, wall, ceiling)

# GLB file size limit
MAX_GLB_KB = 100

# Export JPEG quality
JPEG_QUALITY = 85
JPEG_QUALITY_NORMAL = 90  # Higher quality for normal maps

# Bake samples
BAKE_SAMPLES_FAST = 1      # diffuse, roughness
BAKE_SAMPLES_NORMAL = 1    # normal maps
BAKE_SAMPLES_AO = 64       # ambient occlusion needs more

# PBR Material parameter ranges (for reference / validation)
MATERIAL_RANGES = {
    'northern_stone': {
        'roughness': (0.75, 0.95),
        'metallic': 0.0,
        'base_color_dark': (0.29, 0.27, 0.25),   # #4a4540
        'base_color_light': (0.42, 0.40, 0.37),   # #6b6560
    },
    'ironwood': {
        'roughness': (0.55, 0.75),
        'metallic': 0.0,
        'base_color_dark': (0.176, 0.133, 0.094),  # #2d2218
        'base_color_light': (0.290, 0.208, 0.145),  # #4a3525
    },
    'dark_iron': {
        'roughness': (0.35, 0.55),
        'metallic': (0.85, 0.95),
        'base_color_dark': (0.145, 0.145, 0.145),  # #252525
        'base_color_light': (0.227, 0.227, 0.227),  # #3a3a3a
    },
    'leather': {
        'roughness': (0.50, 0.70),
        'metallic': 0.0,
        'base_color_dark': (0.239, 0.169, 0.102),  # #3d2b1a
        'base_color_light': (0.361, 0.251, 0.188),  # #5c4030
    },
    'ceramic': {
        'roughness': (0.30, 0.50),
        'metallic': 0.0,
        'base_color_dark': (0.45, 0.38, 0.32),
        'base_color_light': (0.60, 0.52, 0.45),
    },
    'fabric': {
        'roughness': (0.80, 1.00),
        'metallic': 0.0,
    },
}
