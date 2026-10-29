# 補償刀時間軸換算

公主連結戰隊戰補償刀時間軸換算工具：貼上完整 1:30 的時間軸，輸入補償刀秒數，自動扣秒並刪除來不及操作的軸。

網址：https://mangochu.github.io/pcr-cb-timecalc/

## 功能

- 依補償刀秒數換算時間軸（`>` 開頭的行跟著上一個時間點一起保留或刪除；CR、全自動打法等說明行原樣保留）
- 截圖 OCR（PaddleOCR PP-OCRv6，在瀏覽器內執行，支援繁中／簡中／日文／英文），並自動修正 O/X、時間格式的常見誤判
- 近期換算紀錄存在瀏覽器 localStorage（最多 30 筆）

## 開發

```bash
pnpm install
pnpm dev       # 開發伺服器
pnpm test      # 單元測試
pnpm build     # 打包到 dist/
```

推送到 `main` 後，GitHub Actions（`.github/workflows/deploy.yml`）會自動測試、打包並部署到 GitHub Pages。
