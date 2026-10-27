<div align="center">

# Pixr Markets

**An open-source project by Pixr.**

Explore the source code, follow development, and contribute to the future of Pixr Markets.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![GitHub](https://img.shields.io/badge/Hosted%20on-GitHub-181717?logo=github)](https://github.com/pixrtm/Pixr-Markets/)

</div>

---

## About

**Pixr Markets** is part of the Pixr project ecosystem. This repository contains its source code and serves as a place to explore the project and follow its development.

The project is released under the **MIT License**, allowing others to use, modify, and redistribute the code under the terms of that license.

The interface is in French. Quotes come from public market sources (Coinbase, Frankfurter, Yahoo Finance, and TradingView charts). The analyst runs in the browser from the figures already on screen. It is not investment advice.

## Repository

You can use this repository to:

- Browse the Pixr Markets source code.
- Review changes and follow development.
- Report bugs or suggest improvements through [GitHub Issues](https://github.com/pixrtm/Pixr-Markets/issues).
- Fork the project and build on it in accordance with the license.

Live site: [https://pixr.dev/pixr-markets/](https://pixr.dev/pixr-markets/)

## What this repository does not contain

No API keys, passwords, mail credentials, OAuth secrets, or account database are stored here. Do not add them.

Signing in with a Pixr account is optional. It only works when this folder is deployed next to the Pixr site and that site provides the account service. Favorites for a signed-in account are written outside this repository. Without that service, selections stay in the browser.

## Getting started

Requirements: Node.js 20 or newer. PHP is required for stock, index, and crypto quotes (`marche.php`) and for optional account sync (`compte.php`). Currency rates are read in the browser from Frankfurter and do not need PHP.

```bash
git clone https://github.com/pixrtm/Pixr-Markets.git
cd Pixr-Markets
npm ci
npm test
npm run build
node server.mjs --open
```

`npm run build` writes the site to the root of this folder: `index.html`, `assets/`, `brand/`, `marche.php`, and `compte.php`. The page source to edit is `index.dev.html` and `src/`. Do not publish `index.dev.html` in place of `index.html`.

On macOS you can also double-click `Lancer Pixr Markets.command`.

## Contributing

Suggestions, bug reports, and improvements are welcome. Before opening a pull request, check the repository's existing issues and documentation.

## License

Distributed under the **MIT License**. See [LICENSE](LICENSE) for the full terms.

Copyright © 2026 **pixr44**.

---

<div align="center">

**Pixr Markets** · Open source under the MIT License

</div>
