<#
  New-Brand.ps1 - ينشئ هوية بصرية لموقع Mohammed Afify
  التشغيل (من داخل مجلد الموقع):
    powershell -ExecutionPolicy Bypass -File .\New-Brand.ps1
  للتطبيق التلقائي على index.html (مع نسخة احتياطية):
    powershell -ExecutionPolicy Bypass -File .\New-Brand.ps1 -Apply
#>
param(
  [string]$SitePath = (Get-Location).Path,
  [string]$SiteUrl  = "https://mohamedafify2025.github.io/mohammed-afify",
  [switch]$Apply
)

# ---------- الألوان (عدّلها هنا فقط) ----------
$Navy   = "#101A32"   # الأساسي
$Navy2  = "#1B2A4E"   # أساسي فاتح
$Amber  = "#F5B83D"   # لون التمييز
$Teal   = "#2DD4BF"   # لون مساعد
$Cloud  = "#F4F6FB"   # الخلفية الفاتحة

function Save($rel, $text) {
  $p = Join-Path $SitePath $rel
  New-Item -ItemType Directory -Force -Path (Split-Path $p) | Out-Null
  [IO.File]::WriteAllText($p, $text, (New-Object Text.UTF8Encoding($false)))
  Write-Host "تم: $rel" -ForegroundColor Green
}

# ---------- 1) الأيقونة (Favicon) ----------
$icon = @"
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="16" fill="$Navy"/>
  <text x="27" y="42" text-anchor="middle" font-family="Georgia,serif" font-weight="700" font-size="24" fill="$Cloud">MA</text>
  <circle cx="53" cy="41" r="4" fill="$Amber"/>
</svg>
"@
Save "brand/favicon.svg" $icon

# ---------- 2) الشعار الأفقي (فاتح وداكن) ----------
function Logo($textColor, $subColor) {
@"
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 80">
  <rect x="8" y="8" width="64" height="64" rx="16" fill="$Navy"/>
  <text x="34" y="49" text-anchor="middle" font-family="Georgia,serif" font-weight="700" font-size="24" fill="$Cloud">MA</text>
  <circle cx="62" cy="48" r="4" fill="$Amber"/>
  <text x="88" y="42" font-family="Segoe UI,Arial,sans-serif" font-weight="700" font-size="26" fill="$textColor">Mohammed Afify</text>
  <text x="89" y="62" font-family="Segoe UI,Arial,sans-serif" font-size="13" letter-spacing="2" fill="$subColor">LEARN · ANALYZE · BUILD</text>
</svg>
"@
}
Save "brand/logo-dark.svg"  (Logo $Navy  $Navy2)    # للخلفيات الفاتحة
Save "brand/logo-light.svg" (Logo $Cloud $Amber)    # للخلفيات الداكنة

# ---------- 3) متغيرات التصميم ----------
$css = @"
@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;800&display=swap');
:root {
  --brand-navy:  $Navy;
  --brand-navy2: $Navy2;
  --brand-amber: $Amber;
  --brand-teal:  $Teal;
  --brand-cloud: $Cloud;
  --brand-font:  'Cairo', 'Segoe UI', Tahoma, sans-serif;
  --brand-radius: 16px;
  --brand-shadow: 0 10px 30px rgba(16, 26, 50, .18);
}
body { font-family: var(--brand-font); }
.brand-btn {
  background: var(--brand-amber); color: var(--brand-navy);
  font-weight: 800; border: 0; border-radius: var(--brand-radius);
  padding: .8rem 1.4rem; box-shadow: var(--brand-shadow); cursor: pointer;
}
.brand-btn:hover { filter: brightness(1.06); transform: translateY(-1px); }
"@
Save "brand/brand.css" $css

# ---------- 4) صورة المشاركة (Open Graph 1200x630) ----------
Add-Type -AssemblyName System.Drawing
$bmp = New-Object System.Drawing.Bitmap 1200, 630
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = 'AntiAlias'
$g.TextRenderingHint = 'AntiAliasGridFit'
$col = { param($h) [System.Drawing.ColorTranslator]::FromHtml($h) }
$g.Clear((& $col $Navy))
$fmt = New-Object System.Drawing.StringFormat
$fmt.Alignment = 'Center'; $fmt.LineAlignment = 'Center'
$fmt.FormatFlags = 'DirectionRightToLeft'

$bar = New-Object System.Drawing.SolidBrush((& $col $Amber))
$g.FillRectangle($bar, 540, 150, 120, 8)

$f1 = New-Object System.Drawing.Font('Segoe UI', 72, [System.Drawing.FontStyle]::Bold)
$f2 = New-Object System.Drawing.Font('Segoe UI', 40, [System.Drawing.FontStyle]::Regular)
$f3 = New-Object System.Drawing.Font('Segoe UI', 24, [System.Drawing.FontStyle]::Regular)
$cloudBrush = New-Object System.Drawing.SolidBrush((& $col $Cloud))
$tealBrush  = New-Object System.Drawing.SolidBrush((& $col $Teal))

$g.DrawString('Mohammed Afify', $f1, $cloudBrush, (New-Object System.Drawing.RectangleF(0, 200, 1200, 130)), $fmt)
$g.DrawString('تعلّم، حلّل، ابنِ، طوّر', $f2, $bar, (New-Object System.Drawing.RectangleF(0, 340, 1200, 80)), $fmt)
$g.DrawString('البرمجة · تحليل البيانات · المحاسبة · Odoo', $f3, $tealBrush, (New-Object System.Drawing.RectangleF(0, 440, 1200, 60)), $fmt)

$out = Join-Path $SitePath 'brand/og-image.png'
$bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
Write-Host "تم: brand/og-image.png" -ForegroundColor Green

# ---------- 5) صفحة معاينة الهوية ----------
$swatches = @(
  @("Navy", $Navy), @("Navy 2", $Navy2), @("Amber", $Amber), @("Teal", $Teal), @("Cloud", $Cloud)
) | ForEach-Object {
  "<div class='s' style='background:$($_[1])'><b>$($_[0])</b><span dir='ltr'>$($_[1])</span></div>"
}
$preview = @"
<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
<title>دليل الهوية</title>
<link rel="stylesheet" href="brand.css">
<style>
 body{margin:0;padding:40px;background:var(--brand-cloud);color:var(--brand-navy)}
 .row{display:flex;gap:12px;flex-wrap:wrap;margin:20px 0}
 .s{width:150px;height:110px;border-radius:14px;padding:12px;display:flex;flex-direction:column;justify-content:flex-end;
    box-shadow:var(--brand-shadow);color:#fff;mix-blend-mode:normal}
 .s:nth-child(3),.s:nth-child(4),.s:nth-child(5){color:#101A32}
 .dark{background:var(--brand-navy);padding:24px;border-radius:16px}
 img{height:70px}
</style></head><body>
<h1>دليل هوية Mohammed Afify</h1>
<h3>الألوان</h3><div class="row">$($swatches -join "`n")</div>
<h3>الشعار</h3>
<div class="row"><img src="logo-dark.svg" alt=""><div class="dark"><img src="logo-light.svg" alt=""></div></div>
<h3>الخط والأزرار</h3>
<p style="font-size:28px;font-weight:800">تعلّم مهارة. وابنِ مستقبلك.</p>
<button class="brand-btn">ابدأ مشروعك</button>
</body></html>
"@
Save "brand/preview.html" $preview

# ---------- 6) التطبيق على الصفحة الرئيسية (اختياري) ----------
if ($Apply) {
  $idx = Join-Path $SitePath 'index.html'
  if (-not (Test-Path $idx)) { Write-Warning "index.html غير موجود في $SitePath"; return }
  $html = [IO.File]::ReadAllText($idx)
  if ($html -match 'brand/brand\.css') { Write-Host "الهوية مضافة مسبقًا." -ForegroundColor Yellow; return }
  Copy-Item $idx "$idx.bak" -Force
  $tags = @"
  <link rel="icon" href="brand/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="brand/brand.css">
  <meta property="og:title" content="Mohammed Afify | تعلّم، حلّل، ابنِ، طوّر">
  <meta property="og:image" content="$SiteUrl/brand/og-image.png">
  <meta name="twitter:card" content="summary_large_image">
</head>
"@
  $html = $html -replace '</head>', $tags
  [IO.File]::WriteAllText($idx, $html, (New-Object Text.UTF8Encoding($false)))
  Write-Host "تم تعديل index.html (النسخة الاحتياطية: index.html.bak)" -ForegroundColor Green
}

Write-Host "`nانتهى. افتح brand/preview.html لمعاينة الهوية." -ForegroundColor Cyan
