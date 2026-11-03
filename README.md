# Kick TV — PS5 Web Player

Unofficial, TV-first web interface for opening Kick channels on PlayStation 5's embedded web view.

## Features
- RTL Arabic UI with Kick-inspired dark/green styling.
- Direct channel playback using Kick's public player embed: `https://player.kick.com/CHANNEL`.
- Manual channel entry, recent channels, local favorites.
- Category shortcuts open Kick's official category pages.
- Large controls and keyboard/focus-friendly buttons for controller navigation.
- Static site: no build step, no API keys, no server secrets.

## Deploy to Cloudflare Pages
This repository is configured as a static site:
- Framework preset: None
- Build command: leave empty
- Build output directory: `/`
- Production branch: `main`

Connect the GitHub repository `moha700m/kick-ps5-` in Cloudflare Pages.

## Important compatibility notes
This is a web app, **not** a native PS5 application. PS5 does not provide a normal installable browser or support installing arbitrary APK/IPA files. The embedded PS5 web view may restrict navigation, cookies, fullscreen, autoplay, or third-party player playback. The Kick player embed is used rather than scraping streams or proxying video. Test on the actual console before treating playback as supported.

The app does not claim to enumerate every Kick live channel through a private/unofficial API. Channel discovery links open Kick's official directory/category pages. Users can play a channel by entering its Kick username.

## Local preview
Open `index.html` in a modern browser or serve this folder with any static HTTP server.

## Legal
Kick TV is an independent community interface and is not affiliated with Kick or Sony/PlayStation. Kick trademarks and player content remain their respective owners' property.