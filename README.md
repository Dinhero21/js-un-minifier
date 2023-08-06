# js-un-minifier

 Reverse-engineering of Minified JavaScript Files via Association

## 📦 Installation

**(Sign-in is required to git clone)**

1. Install via `Code > Download ZIP` and *unzip* or `git clone https://github.com/Dinhero21/js-un-minifier` via command line.
2. Open the directory in which `js-un-minifier` was installed to. (Should be named `js-un-minifier`)
3. Run `npm i`.
4. Run `npm build`.

## 🚀 Usage

Run `npm run generate-map` to populate `mapping-out` with the mappings present in `mapping-in`.

Run `npm run un-minify` to un-minify `inflate/in.js` into `inflate/out.js`.

### auto-npm

⚠️ This will take a very long time and use a lot of fs, might damage hard drives or SSDs ⚠️

auto-npm allows you to automatically generate mappings with a single command.

Run `./auto-npm/generate.sh` to automatically download the top 50 packages from NPM. Than copy the `auto-npm/packages` folder into `mapping-in`.
