# FiveM Enhanced `.NET 10` (`clrcore-v2`) SDK — API Reference

Unofficial offline & web API reference for the **FiveM Enhanced `.NET 10` (`clrcore-v2`) SDK (`0.0.5-alpha`)**, generated directly via binary reflection and IL inspection of the official `net10.0` NuGet packages:

- `CitizenFX.Base` (`0.0.5-alpha`)
- `CitizenFX.FiveM.Shared` (`0.0.5-alpha`)
- `CitizenFX.FiveM.Client` (`0.0.5-alpha`)
- `CitizenFX.FiveM.Server` (`0.0.5-alpha`)

## Live Documentation

**GitHub Pages:** https://nullptrpup.github.io/fivem-dotnet10-docs/

## Key Features

- **Instant Client-Side Search (`Ctrl+K` / `/`):** Fuzzy, prefix, camelCase acronym, return-type, and hex hash search across all **157 public types**, members, natives, and extensions (`Esc` clears and closes).
- **Complete Native Reference (9,213 Natives):**
  - **8,813 Client Natives** grouped into 18 domain categories (`Vehicle`, `Ped`, `Player`, `Network`, `Graphics`, `FiveM / Resource / NUI`, etc.).
  - **400 Server Natives** grouped into 6 categories.
  - **100% IL-Verified Native Hashes:** Searchable with or without the `0x` prefix (e.g. `0xD80958FC74E988A6` or `D80958FC74E988A6`).
  - Quick filter pills: `All`, `Client Only`, `Server Only`, `Returns Bool`, and `Entity Extensions`.
- **2,113 Client Entity Extension Methods:** Full signatures for `PedExtensions`, `VehicleExtensions`, `WorldEntityExtensions`, `PlayerExtensions`, `PropExtensions`, `BlipExtensions`, and `CheckpointExtensions`.
- **Verified `.NET 10` Script Lifecycle & Migration Guide:** Ground-truth documentation for `IScript`, `[OnTick]`, `[OnEvent]`, `[OnNetEvent]`, `[OnCommand]`, `[ExportMethod]`, `[OnNuiCallback]`, `[FromSource]`, `[FromRawCommand]`, plus a side-by-side `Legacy Mono` → `.NET 10` migration tab (`#quickstart`).
- **Shareable Deep Links:** Direct URL hash routing for types (`#type=...`), natives (`#native=client/PlayerPedId`), categories (`#natives=client/Player`), and quick-start (`#quickstart`).
- **100% Offline & Zero CDN Dependencies:** All HTML, CSS, JS, inline SVG favicon, and pre-indexed API bundles are completely self-contained.

## Local / Offline Usage

No build step or local web server is required:

```bash
git clone https://github.com/nullptrpup/fivem-dotnet10-docs.git
```

Then open `index.html` directly in any modern browser (`file://`) — search, navigation, deep linking, and copy-to-clipboard all work completely offline.

## Disclaimer

This is an **unofficial community reference** generated via binary reflection of the public CitizenFX NuGet packages (`0.0.5-alpha`, `net10.0`). It is not affiliated with, endorsed by, or maintained by Cfx.re, Rockstar Games, or Take-Two Interactive.
