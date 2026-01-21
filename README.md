<p align="center">
  <img src="extension/icon128.png" alt="Box VDR Extractor" width="100">
</p>

<h1 align="center">Box VDR Extractor</h1>

<p align="center">
  <img src="https://img.shields.io/github/stars/fedster99/box-vdr-extractor?style=social" alt="Stars">
</p>

---

## The Story

Last week I was doing due diligence on a deal.

The company put all their docs in a Box VDR. Hundreds of files. Financial models, contracts, the works.

**Problem: Box doesn't let you download anything.**

I'm sitting there thinking... am I really about to screenshot 200 pages? At 11pm?

No. Absolutely not.

So I did what any reasonable person would do. I asked Claude if there was a way to extract these docs programmatically.

Turns out: yes. Box renders everything as HTML canvas elements. You can capture them.

3 hours later I had a working Chrome extension.

**Now I'm open-sourcing it because nobody should have to screenshot a VDR ever again.**

---

## What It Does

1. You open a doc in Box VDR
2. You click the extension
3. It scrolls through every page, captures it in high-res, and stitches it into a PDF
4. PDF downloads to your computer

That's it. No login. No account. No "enterprise pricing." Just works.

---

## Install (takes 2 min)

1. **[Download this repo](../../archive/refs/heads/main.zip)**
2. Unzip it somewhere you won't delete
3. Go to `chrome://extensions/`
4. Turn on **Developer Mode** (top right)
5. Click **Load Unpacked**
6. Select the `extension` folder

Done. Icon shows up in your toolbar.

---

## Tips

- **Maximize your browser window** — bigger window = higher resolution capture
- **Close the sidebar** — that thumbnail panel eats pixels from the main viewer
- **Let pages load** — wait til they're crisp before extracting

---

## FAQ

**Is this sketchy?**

No. It runs 100% locally. Your docs never leave your browser. Zero network requests. Check the code yourself — it's like 400 lines.

**Will I get in trouble?**

Only extract stuff you're allowed to access. Don't be stupid. This is a productivity tool, not a hacking tool.

**Why is my PDF blurry?**

Sidebar is open. Close it. Trust me.

**Does it work on other sites?**

Just Box for now. Different sites render docs differently.

---

## The Build

**Tech:** Vanilla JS, no frameworks, Manifest V3, jsPDF for PDF generation.

**Time to build:** ~3 hours

**Lines of code:** <500

**Tools used:** Claude, VSCode, coffee

Sometimes the best tools are the ones you build yourself at midnight because you're annoyed.

---

## Contribute

Found a bug? Want to add something? PRs open.

This started as a "I need this right now" project. If you want to make it better, go for it.

---

## Why Open Source This?

Because I've been on the other end of this.

Stuck on some random problem at night. Googling frantically. Finding some random GitHub repo that solves exactly what I need.

That person didn't have to share it. But they did. And it saved me hours.

Paying it forward.

---

<p align="center">
  <br>
  <b>If this helped you, star the repo.</b><br>
  <sub>Helps other people find it when they're stuck too.</sub>
  <br><br>
  <a href="https://github.com/fedster99/box-vdr-extractor">Star on GitHub</a>
</p>

---

<sub>Built with Claude. Shipped with frustration. MIT License.</sub>
