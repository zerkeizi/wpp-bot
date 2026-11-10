# Test fixtures

Synthetic media generated with the bundled ffmpeg (no copyrighted content). To regenerate, run from this folder:

```bash
FF=$(node -e "import('@ffmpeg-installer/ffmpeg').then(m=>console.log(m.default.path))")
$FF -y -f lavfi -i testsrc2=s=640x360 -frames:v 1 -q:v 4 landscape.jpg
$FF -y -f lavfi -i mandelbrot=s=300x450 -frames:v 1 portrait.png
$FF -y -f lavfi -i testsrc2=s=320x180:d=12:r=15 -c:v libx264 -pix_fmt yuv420p -crf 35 clip-12s.mp4
$FF -y -f lavfi -i testsrc2=s=200x150:d=1:r=10 animation.gif
head -c 4000 clip-12s.mp4 > corrupt.mp4
```

- `clip-12s.mp4` is longer than the 10 s limit for animated stickers on purpose.
- `corrupt.mp4` is a truncated video that ffmpeg must reject without crashing the process.
