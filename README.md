# js-un-minifier

 Reverse-engineering of Minified JavaScript Files via Association

## 📦 Installation

**(Sign-in is required to git clone)**

1. Install via `Code > Download ZIP` and *unzip* or `git clone https://github.com/Dinhero21/js-un-minifier` via command line.
2. Open the directory in which `js-un-minifier` was installed to. (Should be named `js-un-minifier`)
3. Run `npm i`.
4. Run `npm build`.

## 🚀 Usage

Set up a [redis](https://redis.io/) database.

Run `npm run generate-map` to populate the database with the files present in `mapping-in`.

Run `npm run un-minify` to un-minify `inflate/in.js` into `inflate/out.js` using the mappings present in the database.

### auto-npm

auto-npm allows you to automatically generate mappings with a single command.

Run `./auto-npm/generate.sh` to automatically download the top 50 packages from NPM. Then copy the `auto-npm/packages` folder into `mapping-in`.

[mapping-in with 200 Packages (~51MiB)](https://ipfs.io/ipfs/QmRZsKmbYGAcpAPVUeUegLACsUb1fxfGZaC4UkhKu278G5?filename=packages.tar.zst)

[Redis Snapshot with 200 packages (~256MiB)](https://ipfs.io/ipfs/QmPBrnwPjupJBRGmLM3Dv275xnxyuF4nXBFaZSNcXsB2p7?filename=package-200.rdb.zst)

[Redis Snapshot with 1000 packages (~409MiB)](https://ipfs.io/ipfs/QmZVDausAsdbhSrz3A5NoF2GBgwg1Tr7AbKkuzPGm3fKJ1?filename=package-1k.rdb.zst)
