// Rack Locator app — self-registering custom element, ported from the original standalone HTML widget.
(function() {
  const CSS_TEXT = "\n  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500;600;700;800&display=swap');\n\n  * { box-sizing: border-box; }\n\n  #rl-root {\n    font-family: 'Inter', sans-serif;\n    color: #2B2B28;\n    background: #F3F1EC;\n    background-image: linear-gradient(#E4E1D8 1px, transparent 1px), linear-gradient(90deg, #E4E1D8 1px, transparent 1px);\n    background-size: 24px 24px;\n    min-height: 100vh;\n    padding: 28px 20px 60px;\n  }\n\n  #rl-root h1 {\n    font-family: 'Barlow Condensed', sans-serif;\n    font-weight: 700;\n    font-size: 30px;\n    letter-spacing: 0.5px;\n    text-transform: uppercase;\n    margin: 0;\n    color: #1E1E1C;\n  }\n\n  .rl-eyebrow {\n    font-family: 'JetBrains Mono', monospace;\n    font-size: 11px;\n    letter-spacing: 1.5px;\n    text-transform: uppercase;\n    color: #B33A2E;\n    font-weight: 600;\n    margin: 0 0 4px;\n  }\n\n  .rl-top {\n    display: flex;\n    justify-content: space-between;\n    align-items: flex-end;\n    flex-wrap: wrap;\n    gap: 16px;\n    margin-bottom: 22px;\n    max-width: 1180px;\n    margin-left: auto;\n    margin-right: auto;\n  }\n\n  .rl-navbtns { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }\n  .rl-backbtn {\n    display: inline-flex; align-items: center; gap: 6px;\n    font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 600;\n    color: #6B6A62; background: #FFF; border: 1px solid #DAD6C9; border-radius: 6px;\n    padding: 8px 14px; cursor: pointer;\n  }\n  .rl-backbtn:hover { border-color: #B33A2E; color: #B33A2E; }\n\n  .rl-viewtoggle {\n    display: flex;\n    background: #E8E5DC;\n    border-radius: 8px;\n    padding: 3px;\n    gap: 2px;\n  }\n  .rl-viewtoggle button {\n    border: none;\n    background: transparent;\n    padding: 8px 16px;\n    font-family: 'Inter', sans-serif;\n    font-size: 13px;\n    font-weight: 600;\n    color: #6B6A62;\n    border-radius: 6px;\n    cursor: pointer;\n  }\n  .rl-viewtoggle button.active {\n    background: #FFFFFF;\n    color: #1E1E1C;\n    box-shadow: 0 1px 2px rgba(0,0,0,0.08);\n  }\n\n  .rl-wrap { max-width: 1180px; margin: 0 auto; }\n\n  /* --- OVERVIEW / BLUEPRINT --- */\n  .rl-warehouse {\n    background: #FFFFFF; border: 1px solid #E4E1D8; border-radius: 12px;\n    padding: 30px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);\n  }\n  .rl-blueprintbody { width: 100%; }\n  .rl-blueprint-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }\n  .rl-blueprint-scroll .rl-blueprintbody { min-width: 720px; }\n  .rl-mainrow { display: flex; align-items: stretch; gap: 4px; width: 100%; }\n  .rl-pairgroup { display: flex; align-items: stretch; flex: 2 1 0; min-width: 0; gap: 4px; }\n  .rl-pairgroup.rl-thinpair { flex: 0 0 auto; }\n  .rl-rackblock.rl-thin { flex: 0 0 80px; }\n\n  .rl-rackrun { transition: filter 0.15s ease, transform 0.15s ease; }\n  .rl-rackrun:hover { filter: brightness(1.08) saturate(1.12); transform: translateY(-6px) scale(1.035); }\n  .rl-rackrun:active { transform: translateY(-2px) scale(1.015); transition: transform 0.05s ease; }\n\n  .rl-rackblock {\n    flex: 1 1 0; min-width: 0; min-height: 300px; cursor: pointer;\n    border: 3px solid #C0392B; border-radius: 10px;\n    background: linear-gradient(180deg, #FBFAF7 0%, #F3EFE6 100%);\n    padding: 14px 6px; text-align: center;\n    display: flex; flex-direction: column; align-items: center; justify-content: center;\n    transition: transform 0.08s ease, box-shadow 0.08s ease;\n  }\n  .rl-rackblock:hover { transform: translateY(-2px); box-shadow: 0 6px 14px -8px rgba(179,58,46,0.5); }\n  .rl-pairgroup .rl-rackblock:first-child { border-radius: 10px 0 0 10px; }\n  .rl-pairgroup .rl-rackblock:last-child { border-radius: 0 10px 10px 0; }\n  .rl-rackblock .rl-rackname {\n    font-family: 'Barlow Condensed', sans-serif; font-weight: 700; font-size: 19px;\n    text-transform: uppercase; letter-spacing: 0.4px; color: #1E1E1C;\n  }\n  .rl-rackblock .rl-rackstat {\n    font-family: 'JetBrains Mono', monospace; font-size: 12.5px; color: #8A877C; margin-top: 7px;\n  }\n  .rl-rackblock .rl-rackticks {\n    display: flex; gap: 3px; justify-content: center; margin-top: 10px; flex-wrap: wrap; max-width: 110px;\n  }\n  .rl-rackticks span { width: 6px; height: 11px; border-radius: 1px; background: #E4E1D8; }\n  .rl-rackticks span.on { background: #6B9E78; }\n\n  .rl-pairbrace {\n    width: 8px; align-self: stretch; flex-shrink: 0;\n    background:\n      repeating-linear-gradient(45deg, #C0392B 0 3px, transparent 3px 11px),\n      repeating-linear-gradient(-45deg, #C0392B 0 3px, transparent 3px 11px);\n    opacity: 0.55;\n  }\n  .rl-pairbrace-h {\n    height: 10px; flex-shrink: 0;\n    background:\n      repeating-linear-gradient(45deg, #C0392B 0 3px, transparent 3px 11px),\n      repeating-linear-gradient(-45deg, #C0392B 0 3px, transparent 3px 11px);\n    opacity: 0.55;\n  }\n\n  .rl-vaisle {\n    flex: 0.55 1 0; min-width: 0;\n    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px;\n  }\n  .rl-vaisle-clickable { cursor: pointer; border-radius: 8px; transition: background 0.08s ease; }\n  .rl-vaisle-clickable:hover { background: #FBEAE7; }\n  .rl-vaisle-clickable:hover .rl-vaisleline { border-color: #C0392B; }\n  .rl-vaisle-clickable .rl-vaislelabel { color: #B33A2E; font-weight: 700; }\n  .rl-vaisleline { flex: 1; width: 0; border-left: 3px dashed #C7C2B2; }\n  .rl-vaislelabel {\n    writing-mode: vertical-rl;\n    font-family: 'JetBrains Mono', monospace; font-size: 13px; font-weight: 600;\n    color: #A6A398; text-transform: uppercase; letter-spacing: 1.5px; white-space: nowrap;\n  }\n\n  .rl-capgroup { display: flex; flex-direction: column; gap: 10px; flex: 0.9 1 0; min-width: 0; }\n  .rl-rackblock-cap {\n    width: 100%; min-height: 72px; flex-direction: row; justify-content: space-between; align-items: center;\n    padding: 10px 18px; gap: 16px;\n  }\n  .rl-rackblock-cap .rl-rackstat { margin-top: 0; }\n  .rl-rackblock-cap .rl-rackticks { margin-top: 0; max-width: 130px; }\n\n  .rl-rackblock-small { min-height: 84px; padding: 10px 8px; flex: 0 0 auto; }\n  .rl-rackblock-short { min-height: 70px; }\n  .rl-rackblock-tall { min-height: 420px; }\n  .rl-emptycross {\n    border-radius: 8px; border: 2px dashed #C7C2B2;\n    background:\n      repeating-linear-gradient(45deg, #C0392B 0 2px, transparent 2px 16px),\n      repeating-linear-gradient(-45deg, #C0392B 0 2px, transparent 2px 16px);\n    opacity: 0.4;\n  }\n  .rl-rackblock-small .rl-rackticks { display: none; }\n\n  .rl-rackblock-corner .rl-rackname { font-size: 11px; white-space: normal; word-break: break-word; line-height: 1.15; text-align: center; }\n  .rl-rackblock-corner .rl-rackstat { font-size: 11px; font-weight: 700; white-space: nowrap; margin-top: 3px; line-height: 1.2; }\n  .rl-rackblock-corner .rl-rackticks { display: none; }\n  .rl-rackblock-fit .rl-rackticks { display: none; }\n  .rl-rackblock-fit .rl-rackname { white-space: normal; text-align: center; line-height: 1.1; }\n  .rl-rackblock-fit .rl-rackstat { white-space: nowrap; }\n\n  .rl-wall { flex: 0 0 14px; display: flex; align-items: stretch; justify-content: center; }\n  .rl-wallline {\n    width: 8px; align-self: stretch; border-radius: 2px;\n    background: repeating-linear-gradient(45deg, #3B3A35 0 4px, #55534C 4px 8px);\n  }\n\n  .rl-cornerwrap { display: flex; flex: 1 1 0; min-width: 0; align-items: stretch; }\n  .rl-cornerspacer { flex: 0.75 0 0; }\n\n  .rl-haisle { display: flex; align-items: center; gap: 16px; padding: 26px 0 22px; width: 100%; }\n  .rl-haisleline { flex: 1; height: 0; border-top: 3px dashed #C0392B; }\n  .rl-haiselabel {\n    font-family: 'JetBrains Mono', monospace; font-size: 13px; font-weight: 600;\n    color: #B33A2E; text-transform: uppercase; letter-spacing: 1.5px; white-space: nowrap;\n  }\n  .rl-bottomrow { display: flex; width: 100%; }\n  .rl-bottomspacer { flex: 1.9 0 0; }\n  .rl-bottomtrailer { flex: 5.1 0 0; }\n  .rl-bottomrow .rl-rackblock-cap { flex: 2 1 0; min-width: 0; }\n\n  /* --- LOADING DOCK MARKERS --- */\n  .rl-dock {\n    flex: 0 0 140px; align-self: flex-end; height: 50%;\n    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;\n  }\n  .rl-dock-panel {\n    width: 100%; flex: 1; min-height: 34px; border-radius: 10px;\n    background: repeating-linear-gradient(45deg, #C0392B 0 3px, #FBFAF7 3px 14px);\n    border: 3px solid #C0392B;\n    box-shadow: 0 6px 14px -8px rgba(179,58,46,0.5);\n  }\n  .rl-docklabel {\n    font-family: 'JetBrains Mono', monospace; font-size: 9px; font-weight: 700;\n    letter-spacing: 0.5px; color: #6B6A62; text-transform: uppercase; white-space: nowrap;\n  }\n\n\n  /* row tabs */\n  .rl-rowtabs { display: flex; align-items: center; gap: 8px; margin-bottom: 20px; flex-wrap: wrap; }\n  .rl-rowtab {\n    font-family: 'JetBrains Mono', monospace;\n    font-size: 13px;\n    font-weight: 600;\n    padding: 8px 14px;\n    border-radius: 6px;\n    background: #FFFFFF;\n    border: 1px solid #DAD6C9;\n    color: #55534C;\n    cursor: pointer;\n  }\n  .rl-rowtab.active { background: #B33A2E; border-color: #B33A2E; color: #FFF7F1; }\n\n  /* config bar */\n  .rl-config {\n    display: flex; align-items: center; gap: 18px; flex-wrap: wrap;\n    background: #FFFFFF; border: 1px solid #E4E1D8; border-radius: 10px;\n    padding: 12px 16px; margin-bottom: 18px; font-size: 13px;\n  }\n  .rl-config label { display: flex; align-items: center; gap: 8px; color: #6B6A62; font-weight: 500; }\n  .rl-config input[type=number] {\n    width: 60px; padding: 5px 8px; border: 1px solid #DAD6C9; border-radius: 5px;\n    font-family: 'JetBrains Mono', monospace; font-size: 13px;\n  }\n  .rl-config input[type=text] {\n    padding: 5px 8px; border: 1px solid #DAD6C9; border-radius: 5px; font-size: 13px; width: 150px;\n  }\n  .rl-config .rl-configspacer { flex: 1; }\n  .rl-configlabel { color: #A6A398; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; }\n  .rl-configvalue { font-family: 'JetBrains Mono', monospace; font-size: 13px; color: #3B3A35; font-weight: 600; }\n\n  /* --- RACK VISUAL --- */\n  .rl-rackscroll { display: flex; justify-content: safe center; padding-bottom: 14px; overflow-x: auto; -webkit-overflow-scrolling: touch; }\n  .rl-rack {\n    display: flex; flex-direction: column; width: max-content; flex: 0 0 auto; min-width: max-content;\n    background: linear-gradient(180deg, #FAF9F5 0%, #EFECE3 100%);\n    border-radius: 10px; padding: 16px 20px 8px;\n    box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 12px 24px -18px rgba(0,0,0,0.35);\n  }\n\n  .rl-level { display: flex; align-items: stretch; }\n  .rl-levelbadge {\n    width: 52px; flex-shrink: 0;\n    display: flex; align-items: center; justify-content: center;\n    font-family: 'Barlow Condensed', sans-serif; font-weight: 700; font-size: 17px;\n    color: #8E2A20; white-space: nowrap;\n  }\n  .rl-shelfarea { flex: 0 0 auto; min-width: max-content; display: flex; flex-direction: column; }\n  .rl-shelfrow { display: flex; align-items: stretch; justify-content: flex-start; padding: 10px 0 8px; gap: 2px; }\n  .rl-beam { height: 8px; background: linear-gradient(180deg, #E08A2B 0%, #C46F1C 100%); border-radius: 2px; box-shadow: inset 0 -2px 0 rgba(0,0,0,0.15); }\n\n  .rl-upright {\n    width: 5px; flex: 0 0 5px; align-self: stretch; margin: 0 3px;\n    background: linear-gradient(90deg, #3A6FD3 0%, #2E5AB8 60%, #22458E 100%);\n    border-radius: 1px;\n  }\n\n  .rl-slot {\n    flex: 1 1 0; min-width: 34px; max-width: 92px; height: var(--slot-h, 64px);\n    border-radius: 4px; cursor: pointer; overflow: visible;\n    display: flex; align-items: flex-end; justify-content: center;\n    position: relative; transition: transform 0.08s ease;\n    border: 1.5px dashed #C7C2B2; background: #FBFAF7;\n  }\n  .rl-slot:hover { transform: translateY(-2px); }\n  .rl-slot[draggable=\"true\"] { cursor: grab; }\n  .rl-slot.rl-drop-ok { outline: 2px solid #6B9E78; outline-offset: 1px; }\n  .rl-slot.rl-drop-bad { outline: 2px solid #B33A2E; outline-offset: 1px; }\n  .rl-flash {\n    position: fixed; top: 22px; left: 50%; transform: translateX(-50%);\n    background: #B33A2E; color: #FFF7F1; font-family: 'Inter', sans-serif; font-weight: 600;\n    font-size: 13px; padding: 10px 18px; border-radius: 8px;\n    box-shadow: 0 10px 24px rgba(0,0,0,0.28); z-index: 100;\n  }\n  .rl-slot.filled {\n    border: 1.5px solid #6B9E78; background: #F1F7F0;\n  }\n\n  /* --- MULTI-DEPTH SLOTS (2 or 3 pallets stacked one behind the other) --- */\n  .rl-slot-depth { flex: 1 1 0; min-width: 34px; max-width: 92px; height: var(--slot-h, 64px); position: relative; }\n  .rl-depth-layer {\n    position: absolute; border-radius: 4px; cursor: pointer;\n    display: flex; align-items: flex-end; justify-content: center;\n    transition: transform 0.08s ease;\n    border: 1.5px dashed #C7C2B2; background: #FBFAF7;\n  }\n  .rl-depth-layer:hover { transform: translateY(-2px); }\n  .rl-depth-layer[draggable=\"true\"] { cursor: grab; }\n  .rl-depth-layer.filled { border: 1.5px solid #6B9E78; background: #F1F7F0; }\n  .rl-depth-layer.rl-drop-ok { outline: 2px solid #6B9E78; outline-offset: 1px; }\n  .rl-depth-layer.rl-drop-bad { outline: 2px solid #B33A2E; outline-offset: 1px; }\n  .rl-depthtag {\n    font-family: 'JetBrains Mono', monospace; font-size: 8px; font-weight: 700;\n    color: #A6A398; letter-spacing: 0.5px; position: relative; z-index: 1; margin-bottom: calc(var(--slot-h, 64px) * 0.3);\n  }\n  .rl-depth-layer.filled .rl-depthtag { color: #6B9E78; }\n  .rl-slot-empty {\n    flex: 1 1 0; min-width: 34px; max-width: 92px; height: var(--slot-h, 64px);\n  }\n  /* pallet look: wood-slat deck across the bottom of the whole slot, with dark\n     block-cutouts near the front to read as a pallet, not just a plain square */\n  .rl-slot::before, .rl-depth-layer::before {\n    content: \"\"; position: absolute; left: 8%; right: 8%; bottom: calc(var(--slot-h, 64px) * 0.09); height: calc(var(--slot-h, 64px) * 0.19);\n    border-radius: 2px;\n    background:\n      repeating-linear-gradient(90deg, #C7BFA8 0 3px, #DCD5C0 3px 9px),\n      linear-gradient(180deg, #E7DFC8 0%, #CFC5A9 100%);\n    background-blend-mode: overlay;\n    box-shadow: inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -2px 0 rgba(0,0,0,0.12);\n  }\n  .rl-slot::after, .rl-depth-layer::after {\n    content: \"\"; position: absolute; left: 20%; width: 14%; bottom: calc(var(--slot-h, 64px) * 0.09); height: calc(var(--slot-h, 64px) * 0.19);\n    background: rgba(43,43,40,0.16); border-radius: 1px;\n    box-shadow: 46% 0 0 rgba(43,43,40,0.16);\n  }\n  .rl-slot.filled::before, .rl-depth-layer.filled::before {\n    background:\n      repeating-linear-gradient(90deg, #9FC7A7 0 3px, #B9DBBF 3px 9px),\n      linear-gradient(180deg, #C7E4CB 0%, #A7D2AF 100%);\n    background-blend-mode: overlay;\n  }\n  .rl-slot.filled::after, .rl-depth-layer.filled::after { background: rgba(45,90,55,0.22); box-shadow: 46% 0 0 rgba(45,90,55,0.22); }\n  .rl-slotcode {\n    font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 800;\n    color: #0D0D0C; white-space: nowrap; position: relative; z-index: 1; margin-bottom: calc(var(--slot-h, 64px) * 0.3);\n  }\n  .rl-slot.filled .rl-slotcode { color: #0D0D0C; }\n  .rl-itembadge {\n    position: absolute; top: -6px; left: 50%; transform: translateX(-50%);\n    background: #6B9E78; color: #F1F7F0;\n    font-family: 'JetBrains Mono', monospace; font-size: 9px; font-weight: 600;\n    border-radius: 8px; padding: 1px 5px; line-height: 1.3;\n  }\n\n  .rl-endpost {\n    width: 6px; flex: 0 0 6px; align-self: stretch; margin: 0 3px;\n    background: linear-gradient(90deg, #3A6FD3 0%, #22458E 100%);\n    border-radius: 2px;\n  }\n\n  .rl-floor {\n    height: 10px; margin-top: 6px;\n    background: linear-gradient(180deg, #D8D2C0 0%, #C4BDA6 100%);\n    border-radius: 3px;\n  }\n\n  /* --- TABLE VIEW --- */\n  .rl-tablebar { display: flex; gap: 10px; align-items: center; margin-bottom: 14px; flex-wrap: wrap; }\n  .rl-search {\n    padding: 8px 12px; border: 1px solid #DAD6C9; border-radius: 6px; font-size: 13px;\n    width: 240px; background: #FFF;\n  }\n  .rl-tablesummary { font-size: 12px; color: #A6A398; }\n  .rl-btn {\n    padding: 8px 14px; border-radius: 6px; font-size: 13px; font-weight: 600;\n    border: 1px solid #DAD6C9; background: #FFF; color: #3B3A35; cursor: pointer;\n  }\n  .rl-btn:hover { border-color: #B33A2E; color: #B33A2E; }\n  .rl-btn.rl-danger:hover { border-color: #B33A2E; background: #FBEAF0; color: #99351A; }\n\n  .rl-table-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; border-radius: 10px; }\n  table.rl-table { width: 100%; min-width: 660px; table-layout: fixed; border-collapse: collapse; background: #FFF; border-radius: 10px; overflow: hidden; border: 1px solid #E4E1D8; }\n  table.rl-table td, table.rl-table th { overflow: hidden; text-overflow: ellipsis; }\n  table.rl-table th {\n    text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;\n    color: #A6A398; font-weight: 600; padding: 10px 14px; background: #F7F5EF; border-bottom: 1px solid #E4E1D8;\n  }\n  table.rl-table td { padding: 8px 14px; font-size: 13px; border-bottom: 1px solid #EFEDE5; vertical-align: middle; }\n  table.rl-table td:nth-child(5), table.rl-table td:nth-child(6),\n  table.rl-table th:nth-child(5), table.rl-table th:nth-child(6) { padding-left: 6px; padding-right: 6px; }\n  table.rl-table tr:last-child td { border-bottom: none; }\n  table.rl-table tr:hover { background: #FBFAF6; }\n  .rl-code { font-family: 'JetBrains Mono', monospace; font-weight: 600; color: #8E2A20; font-size: 12.5px; }\n  table.rl-table input {\n    width: 100%; border: 1px solid transparent; padding: 5px 7px; border-radius: 5px; font-size: 13px; font-family: inherit;\n    background: transparent;\n  }\n  table.rl-table input:hover, table.rl-table input:focus { border-color: #DAD6C9; background: #FFF; outline: none; }\n  .rl-emptytag { color: #B7B3A5; font-style: italic; font-size: 12px; }\n\n  /* --- MODAL --- */\n  .rl-overlay {\n    position: fixed; inset: 0; background: rgba(30,28,24,0.45);\n    display: flex; align-items: center; justify-content: center; z-index: 50; padding: 20px;\n  }\n  .rl-modal {\n    background: #FFF; border-radius: 12px; padding: 24px; width: min(460px, 92vw); max-height: 88vh; overflow-y: auto;\n    box-shadow: 0 20px 50px rgba(0,0,0,0.25);\n  }\n  .rl-modal h3 {\n    font-family: 'Barlow Condensed', sans-serif; font-size: 22px; font-weight: 700; margin: 0 0 2px;\n    text-transform: uppercase; letter-spacing: 0.5px;\n  }\n  .rl-modal .rl-code { font-size: 13px; }\n  .rl-itemcard {\n    border: 1px solid #E4E1D8; border-radius: 7px; padding: 10px; margin-top: 8px; position: relative;\n    background: #FCFBF8;\n  }\n  .rl-itemcard .rl-itemnum {\n    font-family: 'JetBrains Mono', monospace; font-size: 9.5px; font-weight: 600; color: #B7B3A5;\n    text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;\n    display: flex; align-items: center; gap: 6px;\n  }\n  .rl-itemmoveicon {\n    border: 1px solid #DAD6C9; background: #FFF; border-radius: 5px; width: 18px; height: 18px;\n    display: inline-flex; align-items: center; justify-content: center; cursor: pointer;\n    color: #6B6A62; font-size: 10px; line-height: 1; padding: 0;\n    font-family: 'Inter', sans-serif; text-transform: none; letter-spacing: normal;\n  }\n  .rl-itemmoveicon:hover, .rl-itemmoveicon.active { border-color: #B33A2E; color: #B33A2E; background: #FBEAE7; }\n  .rl-itemremove {\n    position: absolute; top: 8px; right: 8px; border: none; background: none; cursor: pointer;\n    color: #B7B3A5; font-size: 12px; font-weight: 600;\n  }\n  .rl-itemremove:hover { color: #B33A2E; }\n  .rl-field { margin-top: 6px; }\n  .rl-fieldrow { display: flex; gap: 6px; margin-top: 6px; align-items: flex-end; }\n  .rl-fieldrow .rl-field { margin-top: 0; }\n  .rl-fieldrow .rl-field:first-child { flex: 0 0 55%; min-width: 0; }\n  .rl-qtyfield { flex: 1; }\n  .rl-qtyfield label {\n    display: block; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px;\n    font-weight: 600; color: #A6A398; margin-bottom: 4px; text-align: center;\n  }\n  .rl-qtyfield input { text-align: center; font-weight: 700; }\n  .rl-field label { display: none; }\n  .rl-field input, .rl-field textarea, .rl-field select {\n    width: 100%; border: 1px solid #DAD6C9; border-radius: 6px; padding: 6px 9px; font-size: 13px; font-family: inherit;\n  }\n  .rl-field textarea { resize: none; min-height: 28px; overflow: hidden; line-height: 1.35; }\n  .rl-addbtn {\n    margin-top: 12px; width: 100%; padding: 9px; border-radius: 7px; border: 1px dashed #B7B3A5;\n    background: transparent; color: #6B6A62; font-size: 13px; font-weight: 600; cursor: pointer;\n  }\n  .rl-addbtn:hover { border-color: #B33A2E; color: #B33A2E; }\n  .rl-modalbtns { display: flex; gap: 8px; margin-top: 22px; }\n  .rl-modalbtns .rl-btn { flex: 1; }\n  .rl-btn.rl-primary { background: #B33A2E; border-color: #B33A2E; color: #FFF7F1; }\n  .rl-btn.rl-primary:hover { background: #8E2A20; border-color: #8E2A20; color: #FFF7F1; }\n\n  .rl-movesection { margin-top: 22px; border-top: 1px solid #E4E1D8; padding-top: 16px; }\n  .rl-movetoggle {\n    width: 100%; background: #FBFAF7; border: 1.5px dashed #C7C2B2; border-radius: 8px;\n    color: #3B3A35; font-size: 14px; font-weight: 600; cursor: pointer;\n    padding: 12px 14px; display: flex; align-items: center; gap: 8px;\n  }\n  .rl-movetoggle:hover { color: #B33A2E; border-color: #B33A2E; background: #FBEAE7; }\n  .rl-movegrid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 14px; }\n  .rl-movefield label {\n    display: block; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;\n    font-weight: 600; color: #A6A398; margin-bottom: 6px;\n  }\n  .rl-movefield select, .rl-movefield input {\n    width: 100%; border: 1.5px solid #E3B400; border-radius: 7px; padding: 10px 11px;\n    font-size: 15px; font-family: inherit; background: #FFF3B0; font-weight: 600; color: #3B3A35;\n  }\n  .rl-movefield select:focus, .rl-movefield input:focus { outline: none; border-color: #B33A2E; }\n  @media (max-width: 420px) {\n    .rl-movegrid { grid-template-columns: 1fr; }\n  }\n\n  .rl-loading { padding: 40px; text-align: center; color: #A6A398; font-size: 14px; }\n\n  /* --- DASHBOARD --- */\n  .rl-whgrid { display: flex; gap: 18px; flex-wrap: wrap; }\n  .rl-whcard {\n    background: #FFFFFF; border: 1px solid #E4E1D8; border-radius: 12px;\n    padding: 22px 24px; min-width: 220px; flex: 1 1 220px; max-width: 320px;\n    cursor: pointer; box-shadow: 0 1px 3px rgba(0,0,0,0.05);\n    transition: transform 0.08s ease, box-shadow 0.08s ease;\n  }\n  .rl-whcard:hover { transform: translateY(-2px); box-shadow: 0 10px 20px -12px rgba(179,58,46,0.4); border-color: #C0392B; }\n  .rl-whname {\n    font-family: 'Barlow Condensed', sans-serif; font-weight: 700; font-size: 22px;\n    text-transform: uppercase; letter-spacing: 0.5px; color: #1E1E1C; margin-bottom: 10px;\n  }\n  .rl-whstat { font-family: 'JetBrains Mono', monospace; font-size: 12.5px; color: #6B6A62; margin-top: 4px; }\n  .rl-whracks { font-size: 11px; color: #A6A398; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 10px; }\n\n  .rl-legend { display: flex; gap: 18px; margin-top: 14px; font-size: 12px; color: #6B6A62; flex-wrap: wrap; }\n  .rl-legend span { display: inline-flex; align-items: center; gap: 6px; }\n  .rl-legenddot { width: 10px; height: 10px; border-radius: 2px; display: inline-block; }\n\n  /* --- MOBILE / NARROW SCREEN ADJUSTMENTS --- */\n  @media (max-width: 640px) {\n    #rl-root { padding: 16px 12px 40px; }\n    #rl-root h1 { font-size: 22px; }\n    .rl-warehouse { padding: 16px 14px; }\n    .rl-modal { padding: 18px; }\n    .rl-top { gap: 12px; margin-bottom: 16px; }\n    .rl-backbtn { padding: 8px 12px; font-size: 12.5px; }\n    .rl-viewtoggle button { padding: 8px 12px; font-size: 12.5px; }\n    .rl-rackblock { min-height: 220px; }\n    .rl-rackblock-short { min-height: 60px; }\n    .rl-fieldrow { flex-direction: column; align-items: stretch; }\n    .rl-fieldrow .rl-field:first-child { flex: none; }\n    .rl-qtyfield { flex: none; }\n    .rl-itemmoveicon { width: 26px; height: 26px; font-size: 12px; }\n    .rl-itemremove { width: 24px; height: 24px; display: inline-flex; align-items: center; justify-content: center; }\n    .rl-config { gap: 12px; padding: 10px 12px; }\n    .rl-tablebar { gap: 8px; }\n    .rl-rowtabs { gap: 6px; margin-bottom: 14px; }\n    .rl-rowtab { padding: 7px 11px; font-size: 12.5px; }\n  }\n\n\n  /* --- MOBILE --- */\n  @media (max-width: 760px) {\n    #rl-root { padding: 14px 12px 28px; }\n    .rl-top { margin-bottom: 16px; gap: 10px; align-items: flex-start; }\n    .rl-top h1 { font-size: 26px; }\n    .rl-navbtns { flex-wrap: wrap; gap: 8px; }\n    .rl-backbtn, .rl-btn { font-size: 12px; padding: 7px 10px; }\n\n    .rl-warehouse { padding: 12px; border-radius: 10px; }\n    .rl-blueprint-scroll .rl-blueprintbody { min-width: 560px; }\n    .rl-rackname { font-size: 14px; }\n    .rl-rackstat { font-size: 10px; }\n    .rl-rackblock { padding: 10px 4px; min-height: 220px; }\n    .rl-rackblock-tall { min-height: 300px; }\n    .rl-rackblock.rl-thin { flex: 0 0 62px; }\n    .rl-levelbadge { width: 40px; font-size: 14px; }\n    .rl-slot, .rl-slot-empty, .rl-slot-depth { min-width: 30px; max-width: 68px; }\n    .rl-slotcode { font-size: 9px; }\n\n    .rl-whgrid { gap: 12px; }\n    .rl-whcard { min-width: 0; max-width: none; flex: 1 1 100%; padding: 16px 18px; }\n\n    .rl-tablebar { gap: 8px; }\n    .rl-search { width: 100%; }\n    table.rl-table { min-width: 560px; }\n    table.rl-table td, table.rl-table th { font-size: 11px; padding: 7px 6px; }\n\n    .rl-modal { padding: 18px 16px; width: min(460px, 94vw); max-height: 90vh; }\n    .rl-modal h3 { font-size: 24px; }\n    .rl-movegrid { grid-template-columns: 1fr 1fr; }\n  }\n\n  /* the site map is percentage-positioned: keep its 16/9 proportions and pan instead\n     of squeezing labels into unreadable slivers on narrow screens */\n  .rl-sitemap-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }\n  .rl-sitemap-scroll .rl-sitemap { min-width: 620px; }\n";

  // Persistence bridge: inside the Damen app the host provides window.storage; a standalone
  // browser session falls back to localStorage so the site still saves.
  const STORE = (window.storage && typeof window.storage.get === 'function') ? window.storage : {
    async get(k) { const v = localStorage.getItem('rl:' + k); return v == null ? null : { value: v }; },
    async set(k, v) { try { localStorage.setItem('rl:' + k, v); } catch (e) {} }
  };

  function initRackLocator(hostEl) {

  const root = hostEl.querySelector('#rl-root');
  const MAX_ITEMS = 40;
  const LEVEL_ORDER = ['E', 'D', 'C', 'B', 'A']; // top to bottom display order when present

  // Some racks store more than one pallet per column position, one behind the other.
  // Maps rackId -> depth count (2 = front/rear, 3 = front/middle/rear). Absent = single-depth.
  const RACK_DEPTH = { 30: 2, 33: 2 }; // Freezer racks #30 and #33 are double-deep (front/rear)
  function rackDepthOf(rackId) { return RACK_DEPTH[rackId] || 1; }
  function isDepthLevel(rackId, level) { return rackDepthOf(rackId) > 1; }
  // The suffix letters used for a rack's depth positions, front-to-back: e.g. ['a','b'] or ['a','b','c'].
  function depthSuffixes(rackId) {
    const d = rackDepthOf(rackId);
    return d === 3 ? ['a', 'b', 'c'] : d === 2 ? ['a', 'b'] : [''];
  }
  // Human label for a depth suffix given the rack's total depth — e.g. on a 3-deep rack,
  // 'b' is "Middle"; on a 2-deep rack, 'b' is "Rear".
  function depthTagFor(rackId, suffix) {
    const d = rackDepthOf(rackId);
    if (!suffix) return '';
    if (suffix === 'a') return 'Front';
    if (d === 3) return suffix === 'b' ? 'Middle' : 'Rear';
    return 'Rear';
  }
  // Diagonal cascade positioning for a depth layer: k=0 is frontmost (bottom-right),
  // k=depth-1 is rearmost (top-left). Explicit tables for depth 2 and 3.
  function depthLayerInset(k, depth) {
    const TABLE = {
      2: [
        { top: '26%', left: '20%', bottom: '0',   right: '0' },   // k=0 front
        { top: '0',   left: '0',   bottom: '26%', right: '20%' }  // k=1 rear
      ],
      3: [
        { top: '52%', left: '34%', bottom: '0',   right: '0' },   // k=0 front
        { top: '26%', left: '17%', bottom: '26%', right: '17%' }, // k=1 middle
        { top: '0',   left: '0',   bottom: '52%', right: '34%' }  // k=2 rear
      ]
    };
    return (TABLE[depth] && TABLE[depth][k]) || TABLE[2][k] || TABLE[2][0];
  }

  // The real warehouse plan (from the floor sketch), read left to right:
  // Rack #16 caps the top of [Rack #17 | Floor 3 aisle]
  // Rack #14 caps the bottom of [Rack15+13 back-to-back | Floor 2 aisle | Rack12+11 back-to-back]
  // then Floor 1 aisle, then Rack #10 standalone, then Rack #5 (corner rack) standalone.
  const DRY_RACK_IDS = [17, 16, 15, 13, 12, 11, 10, 5, 14];

  // Ground-truth location list from Locations.xlsx — every slot that physically exists.
  // A location NOT in this list is not rendered at all (no rack, aisle, or column has it).
  const DRY_VALID_LOCATIONS = [
    '5-A-1','5-A-2','5-A-3','5-A-4','5-B-1','5-B-2','5-B-3','5-B-4','10-A-1','10-A-2','10-A-5','10-A-6',
    '10-A-7','10-A-8','10-A-9','10-A-10','10-A-11','10-A-12','10-A-13','10-A-14','10-A-15','10-A-16','10-A-17','10-A-18',
    '10-A-19','10-A-20','10-A-21','10-A-22','10-A-23','10-A-24','10-A-25','10-A-26','10-B-1','10-B-2','10-B-5','10-B-6',
    '10-B-7','10-B-8','10-B-9','10-B-10','10-B-11','10-B-12','10-B-13','10-B-14','10-B-15','10-B-16','10-B-17','10-B-18',
    '10-B-19','10-B-20','10-B-21','10-B-22','10-B-23','10-B-24','10-B-25','10-B-26','10-C-1','10-C-2','10-C-3','10-C-4',
    '10-C-5','10-C-6','10-C-7','10-C-8','10-C-9','10-C-10','10-C-11','10-C-12','10-C-13','10-C-14','10-C-15','10-C-16',
    '10-C-17','10-C-18','10-C-19','10-C-20','10-C-21','10-C-22','10-C-23','10-C-24','10-C-25','10-C-26','11-A-1','11-A-2',
    '11-A-3','11-A-4','11-A-5','11-A-6','11-A-7','11-A-8','11-A-9','11-A-10','11-A-11','11-A-12','11-A-13','11-A-14',
    '11-A-15','11-A-16','11-A-17','11-A-18','11-A-19','11-A-20','11-A-21','11-A-22','11-B-1','11-B-2','11-B-3','11-B-4',
    '11-B-5','11-B-6','11-B-7','11-B-8','11-B-9','11-B-10','11-B-11','11-B-12','11-B-13','11-B-14','11-B-15','11-B-16',
    '11-B-17','11-B-18','11-B-19','11-B-20','11-B-21','11-B-22','11-C-1','11-C-2','11-C-3','11-C-4','11-C-5','11-C-6',
    '11-C-7','11-C-8','11-C-9','11-C-10','11-C-11','11-C-12','11-C-13','11-C-14','11-C-15','11-C-16','11-C-17','11-C-18',
    '11-C-19','11-C-20','11-C-21','11-C-22','12-A-1','12-A-2','12-A-5','12-A-6','12-A-7','12-A-8','12-A-9','12-A-10',
    '12-A-11','12-A-12','12-A-13','12-A-14','12-A-15','12-A-16','12-A-17','12-A-18','12-A-19','12-A-20','12-B-1','12-B-2',
    '12-B-5','12-B-6','12-B-7','12-B-8','12-B-9','12-B-10','12-B-11','12-B-12','12-B-13','12-B-14','12-B-15','12-B-16',
    '12-B-17','12-B-18','12-B-19','12-B-20','12-C-1','12-C-2','12-C-3','12-C-4','12-C-5','12-C-6','12-C-7','12-C-8',
    '12-C-9','12-C-10','12-C-11','12-C-12','12-C-13','12-C-14','12-C-15','12-C-16','12-C-17','12-C-18','12-C-19','12-C-20',
    '12-D-9','12-D-10','12-D-11','12-D-12','12-D-13','12-D-14','12-D-15','12-D-16','12-D-17','12-D-18','12-D-19','12-D-20','13-A-1','13-A-2',
    '13-A-3','13-A-4','13-A-5','13-A-6','13-A-7','13-A-8','13-A-9','13-A-10','13-A-11','13-A-12','13-A-13','13-A-14',
    '13-A-15','13-A-16','13-A-17','13-A-18','13-B-1','13-B-2','13-B-3','13-B-4','13-B-5','13-B-6','13-B-7','13-B-8',
    '13-B-9','13-B-10','13-B-11','13-B-12','13-B-13','13-B-14','13-B-15','13-B-16','13-B-17','13-B-18','13-C-1','13-C-2',
    '13-C-3','13-C-4','13-C-5','13-C-6','13-C-7','13-C-8','13-C-9','13-C-10','13-C-11','13-C-12','13-C-13','13-C-14',
    '13-C-15','13-C-16','13-C-17','13-C-18','13-D-1','13-D-2','13-D-3','13-D-4','14-A-1','14-A-2',
    '14-A-3','14-A-4','14-A-5','14-A-6','14-B-1','14-B-2','14-B-3','14-B-4','14-B-5','14-B-6','15-A-1','15-A-2',
    '15-A-3','15-A-4','15-A-5','15-A-6','15-A-7','15-A-8','15-A-9','15-A-10','15-A-11','15-A-12','15-A-13','15-A-14',
    '15-A-15','15-A-16','15-A-17','15-A-18','15-B-1','15-B-2','15-B-3','15-B-4','15-B-5','15-B-6','15-B-7','15-B-8',
    '15-B-9','15-B-10','15-B-11','15-B-12','15-B-13','15-B-14','15-B-15','15-B-16','15-B-17','15-B-18','15-C-1','15-C-2',
    '15-C-3','15-C-4','15-C-5','15-C-6','15-C-7','15-C-8','15-C-9','15-C-10','15-C-11','15-C-12','15-C-13','15-C-14',
    '15-C-15','15-C-16','15-C-17','15-C-18','15-D-3','15-D-4','15-D-5','15-D-6','15-D-7','15-D-8','15-D-9','15-D-10',
    '15-D-13','15-D-14','16-A-1','16-A-2','16-B-1','16-B-2',
    '16-C-1','16-C-2','17-A-3','17-A-4','17-A-5','17-A-6','17-A-7','17-A-8','17-A-9','17-A-10','17-A-11','17-A-12',
    '17-A-13','17-A-17','17-A-18','17-A-19','17-B-3','17-B-4','17-B-5','17-B-6','17-B-7','17-B-8','17-B-9','17-B-10',
    '17-B-11','17-B-12','17-B-13','17-B-17','17-B-18','17-B-19','17-C-1','17-C-2','17-C-5','17-C-6',
    '17-C-7','17-C-8','17-C-9','17-C-10','17-C-11','17-C-12','17-C-13','17-C-14','17-C-15','17-C-16','17-C-17','17-C-18',
    '17-C-19','17-D-9','17-D-10','17-D-11','17-D-12','17-D-13','17-D-17','17-D-18',
    '17-D-19',
    '17-E-9','17-E-10','17-E-11','17-E-12'
  ];

  // Freezer floor plan, from the hand-drawn sketch: Rack #33 alone, Floor 3 aisle,
  // Rack #32+31 back-to-back, Floor 2 aisle, Rack #30 alone, and a Returns/Floor 1 area.
  // Confirmed real layout: racks 30, 31, 32, and 33 each run positions 1-20, levels A-C,
  // 2 pallets per column (post).
  const FREEZER_RACK_IDS = [33, 32, 31, 30];
  // Rack #30: only columns 5, 6, 19, and 20 go up to level C — every other column on
  // Rack #30 only has levels A and B.
  const RACK30_C_POSITIONS = new Set([5, 6, 19, 20]);
  const FREEZER_VALID_LOCATIONS = (function() {
    const out = [];
    FREEZER_RACK_IDS.forEach(id => {
      ['A', 'B', 'C'].forEach(level => {
        for (let p = 1; p <= 20; p++) {
          if (id === 30 && level === 'C' && !RACK30_C_POSITIONS.has(p)) continue;
          if (isDepthLevel(id, level)) depthSuffixes(id).forEach(s => out.push(id + '-' + level + '-' + p + s));
          else out.push(id + '-' + level + '-' + p);
        }
      });
    });
    return out;
  })();

  // Fridge 40 real layout: Rack #40 is positions 1-10 on level A, double-depth (front/
  // rear: a/b). Rack #41 is only positions 1-2 on level A, triple-depth (a/b/c).
  // Rack #42 is positions 1-10 on level A, double-depth (front/rear: a/b).
  const FRIDGE_DEPTH_SPECS = { 40: 10, 41: 2, 42: 10 };
  // Racks 40 and 42 have 2 levels (A, B); Rack 41 has 3 levels (A, B, C).
  const FRIDGE_LEVEL_SPECS = { 40: ['A', 'B'], 41: ['A', 'B', 'C'], 42: ['A', 'B'] };

  // Build per-rack layout: which levels exist anywhere in the rack (top-to-bottom display
  // order), the highest column number, and a fast lookup set of "LEVEL-pos" slots that exist.
  function buildLayout(rackIds, validLocations) {
    const layout = {};
    rackIds.forEach(id => { layout[id] = { levels: new Set(), maxPos: 0, exists: new Set() }; });
    validLocations.forEach(code => {
      const [rack, level, pos] = code.split('-');
      const l = layout[rack];
      if (!l) return;
      l.levels.add(level);
      l.maxPos = Math.max(l.maxPos, parseInt(pos, 10));
      l.exists.add(level + '-' + pos);
    });
    Object.values(layout).forEach(l => { l.levelsOrder = LEVEL_ORDER.filter(x => l.levels.has(x)); });
    return layout;
  }
  const DRY_LAYOUT = buildLayout(DRY_RACK_IDS, DRY_VALID_LOCATIONS);
  const FREEZER_LAYOUT = buildLayout(FREEZER_RACK_IDS, FREEZER_VALID_LOCATIONS);

  // Fridge 40 floor plan, from the hand-drawn sketch: Floor #2 sits top-left next to
  // Rack #41 (wide, top-right). Rack #41 and Rack #40 share a physical frame (the X mark),
  // with Rack #41 on top and Rack #40 directly below it. Rack #42 sits bottom-left next to
  // the Floor 1 aisle, aligned under Floor #2.
  const FRIDGE_RACK_IDS = [42, 41, 40];
  const FRIDGE_VALID_LOCATIONS = (function() {
    const out = [];
    FRIDGE_RACK_IDS.forEach(id => {
      const maxPos = FRIDGE_DEPTH_SPECS[id] || 10;
      const levels = FRIDGE_LEVEL_SPECS[id] || ['A'];
      levels.forEach(level => {
        for (let p = 1; p <= maxPos; p++) {
          depthSuffixes(id).forEach(s => out.push(id + '-' + level + '-' + p + s));
        }
      });
    });
    return out;
  })();
  const FRIDGE_LAYOUT = buildLayout(FRIDGE_RACK_IDS, FRIDGE_VALID_LOCATIONS);

  // Fridge 50: same sizing/shape rules as Fridge 40, new rack numbers. Rack #51 (short,
  // wide) mirrors Rack #41's spec (2 positions, 3 levels). Racks #52/#50 (tall) mirror
  // Rack #42/#40's spec (10 positions, 2 levels).
  const FRIDGE50_DEPTH_SPECS = { 50: 12, 51: 2, 52: 12 };
  const FRIDGE50_LEVEL_SPECS = { 50: ['A', 'B'], 51: ['A', 'B', 'C'], 52: ['A', 'B'] };
  // Positions 11 and 12 on Racks #50/#52 only have level A — no level B there.
  const FRIDGE50_A_ONLY_POSITIONS = new Set([11, 12]);
  const FRIDGE50_RACK_IDS = [52, 51, 50];
  const FRIDGE50_VALID_LOCATIONS = (function() {
    const out = [];
    FRIDGE50_RACK_IDS.forEach(id => {
      const maxPos = FRIDGE50_DEPTH_SPECS[id] || 10;
      const levels = FRIDGE50_LEVEL_SPECS[id] || ['A'];
      levels.forEach(level => {
        for (let p = 1; p <= maxPos; p++) {
          if ((id === 50 || id === 52) && level === 'B' && FRIDGE50_A_ONLY_POSITIONS.has(p)) continue;
          depthSuffixes(id).forEach(s => out.push(id + '-' + level + '-' + p + s));
        }
      });
    });
    return out;
  })();
  const FRIDGE50_LAYOUT = buildLayout(FRIDGE50_RACK_IDS, FRIDGE50_VALID_LOCATIONS);

  // Fridge 60: same sizing/shape rules as Fridge 40. Rack #61 (short, wide) mirrors Rack
  // #41's spec (2 positions, 3 levels). Racks #60/#62/#63 (tall/long) mirror Rack #42/#40's
  // spec (10 positions, 2 levels).
  const FRIDGE60_DEPTH_SPECS = { 60: 9, 61: 3, 62: 14, 63: 12 };
  const FRIDGE60_LEVEL_SPECS = { 60: ['A', 'B', 'C'], 61: ['A', 'B'], 62: ['A', 'B', 'C', 'D'], 63: ['A', 'B'] };
  // Rack #60: only positions 7 and 8 go up to level C — every other column is A/B only.
  const RACK60_C_POSITIONS = new Set([7, 8, 9]);
  // Rack #62: level C runs the full length; level D only has positions 13, 14 and 11;
  // level B is missing positions 3 and 4.
  const RACK62_D_POSITIONS = new Set([13, 14, 11]);
  const RACK62_B_MISSING = new Set([3, 4]);
  // Racks whose posts don't sit at a uniform pallets-per-column interval: explicit
  // position groups, one array per column (between uprights). Rack #60's 7/8 column
  // holds a third pallet (9).
  const COLUMN_GROUPS = {
    60: [[1, 2], [3, 4], [5, 6], [7, 8, 9]]
  };
  const FRIDGE60_RACK_IDS = [62, 60, 61, 63];
  const FRIDGE60_VALID_LOCATIONS = (function() {
    const out = [];
    FRIDGE60_RACK_IDS.forEach(id => {
      const maxPos = FRIDGE60_DEPTH_SPECS[id] || 10;
      const levels = FRIDGE60_LEVEL_SPECS[id] || ['A'];
      levels.forEach(level => {
        for (let p = 1; p <= maxPos; p++) {
          if (id === 60 && level === 'C' && !RACK60_C_POSITIONS.has(p)) continue;
          if (id === 62 && level === 'D' && !RACK62_D_POSITIONS.has(p)) continue;
          if (id === 62 && level === 'B' && RACK62_B_MISSING.has(p)) continue;
          depthSuffixes(id).forEach(s => out.push(id + '-' + level + '-' + p + s));
        }
      });
    });
    return out;
  })();
  const FRIDGE60_LAYOUT = buildLayout(FRIDGE60_RACK_IDS, FRIDGE60_VALID_LOCATIONS);

  const WAREHOUSES = {
    dry: {
      id: 'dry', name: 'Dry Products',
      rackIds: DRY_RACK_IDS, layout: DRY_LAYOUT,
      floorIds: [1, 2, 3], floorLabel: id => 'Floor ' + id,
      storagePrefix: '' // unprefixed keys — keeps existing saved Dry Products data working
    },
    freezer: {
      id: 'freezer', name: 'Freezer',
      rackIds: FREEZER_RACK_IDS, layout: FREEZER_LAYOUT,
      floorIds: ['returns', 'floor1', 'floor2', 'floor3'],
      floorLabel: id => ({ returns: 'Returns', floor1: 'Floor 1', floor2: 'Floor 2', floor3: 'Floor 3' }[id] || id),
      storagePrefix: 'freezer-'
    },
    fridge40: {
      id: 'fridge40', name: 'Fridge 40',
      rackIds: FRIDGE_RACK_IDS, layout: FRIDGE_LAYOUT,
      floorIds: ['floor2', 'floor1'],
      floorLabel: id => ({ floor2: 'Floor #2', floor1: 'Floor 1' }[id] || id),
      storagePrefix: 'fridge40-'
    },
    fridge50: {
      id: 'fridge50', name: 'Fridge 50',
      rackIds: FRIDGE50_RACK_IDS, layout: FRIDGE50_LAYOUT,
      floorIds: ['floor3', 'floor2', 'floor1'],
      floorLabel: id => ({ floor3: 'Floor 3', floor2: 'Floor 2', floor1: 'Floor 1' }[id] || id),
      storagePrefix: 'fridge50-'
    },
    fridge60: {
      id: 'fridge60', name: 'Fridge 60',
      rackIds: FRIDGE60_RACK_IDS, layout: FRIDGE60_LAYOUT,
      floorIds: ['floor2', 'floor1'],
      floorLabel: id => ({ floor2: 'Floor 2', floor1: 'Floor 1' }[id] || id),
      storagePrefix: 'fridge60-'
    }
  };

  // Mutable "current warehouse" pointers — reassigned by switchWarehouse() below.
  // Rest of the code below reads these as if they were the only warehouse, same as before.
  let CURRENT_WH = WAREHOUSES.dry;
  let RACK_IDS = CURRENT_WH.rackIds;
  let RACK_LAYOUT = CURRENT_WH.layout;
  let FLOOR_IDS = CURRENT_WH.floorIds;

  function slotExists(rackId, level, pos) {
    const layout = RACK_LAYOUT[rackId];
    return !!layout && layout.exists.has(level + '-' + pos);
  }

  let state = {
    warehouseId: null, // null while on the dashboard
    rows: [],
    data: {},
    screen: 'map', // map | dashboard | overview | rack | table
    activeRowId: null,
    search: '',
    editing: null, // {rowId, level, pos, items, showMove, moveTarget:{whId,rowId,level,pos}}
    floorData: {}, // {floorId: [{sku,description}], ...}
    floorEditing: null, // {floorId, items}
    flash: null, // transient message shown after an invalid drag-drop
    findQuery: '',
    findView: 'table', // 'table' (spreadsheet of all items + locations) | 'list' (cards)
    placing: null, // {sku, description} picked from the catalog, waiting to be dropped on a slot
    catalogQuery: '',
    catalogFilter: 'all', // all | located | unlocated
    ready: false
  };
  let flashTimer = null;
  const whCache = {}; // { dry: {rows,data,floorData}, freezer: {rows,data,floorData} }

  /* ---------------- ITEM CATALOG (inventory database) ---------------- */
  // window.DAMEN_CATALOG is generated from the Damen item export: {c: code, d: description, s: section}
  const CATALOG = Array.isArray(window.DAMEN_CATALOG) ? window.DAMEN_CATALOG : [];
  const CATALOG_BY_CODE = {};
  const CATALOG_BY_DESC = {};
  CATALOG.forEach(it => {
    CATALOG_BY_CODE[it.c.toUpperCase()] = it;
    CATALOG_BY_DESC[it.d.toUpperCase()] = it;
  });
  function catalogByCode(code) { return CATALOG_BY_CODE[String(code || '').trim().toUpperCase()] || null; }
  function catalogByDesc(desc) { return CATALOG_BY_DESC[String(desc || '').trim().toUpperCase()] || null; }
  let catalogDatalistCache = null;
  function catalogDatalists() {
    if (catalogDatalistCache) return catalogDatalistCache;
    const codes = CATALOG.map(it => '<option value="' + esc(it.c) + '">' + esc(it.d) + '</option>').join('');
    const descs = CATALOG.map(it => '<option value="' + esc(it.d) + '">' + esc(it.c) + '</option>').join('');
    catalogDatalistCache = '<datalist id="rl-cat-codes">' + codes + '</datalist>' +
                           '<datalist id="rl-cat-descs">' + descs + '</datalist>';
    return catalogDatalistCache;
  }

  /* ---------------- CATALOG AUTOCOMPLETE (phone-friendly dropdown) ----------------
     Native <datalist> dropdowns barely work on phones, so any input marked with
     class="rl-cat-input" (data-editor="rack"|"floor", data-index="i") gets its own
     floating suggestion list. Typing a code OR description filters the catalog and
     tapping a match fills in both fields on the matching item. */
  let acEl = null, acInput = null, acMatches = [], acActive = -1;
  let acDownOpt = null, acDownX = 0, acDownY = 0, acDragged = false;

  function catalogMatches(q, limit) {
    q = String(q || '').trim().toLowerCase();
    if (!q) return [];
    limit = limit || 40;
    const starts = [], contains = [];
    for (const it of CATALOG) {
      const c = it.c.toLowerCase(), d = it.d.toLowerCase();
      if (c.startsWith(q) || d.startsWith(q)) starts.push(it);
      else if (c.indexOf(q) >= 0 || d.indexOf(q) >= 0) contains.push(it);
      if (starts.length >= limit) break;
    }
    return starts.concat(contains).slice(0, limit);
  }

  function acHide() {
    if (acEl) acEl.style.display = 'none';
    acInput = null; acMatches = []; acActive = -1; acNudged = false;
  }
  const AC_MARGIN = 8;   // keep the list this clear of every screen edge
  const AC_GAP = 2;      // breathing room between the field and the list
  const AC_MIN_ROOM = 132; // below this, nudge the field up rather than squash the list

  // How much of the screen is really usable, and where the visible box sits.
  // With a phone keyboard open window.innerHeight still reports the full page
  // height, so sizing against it puts the list behind the keyboard. Note that
  // position:fixed resolves against the *layout* viewport, so getBoundingClientRect
  // values are already in the right space — only the sizing needs the visual one.
  function acViewport() {
    const vv = window.visualViewport;
    return {
      w: vv ? vv.width : window.innerWidth,
      h: vv ? vv.height : window.innerHeight,
      x: vv ? vv.offsetLeft : 0,
      y: vv ? vv.offsetTop : 0
    };
  }
  function acRoomBelow(r, v) { return (v.y + v.h) - r.bottom - AC_GAP - AC_MARGIN; }

  function acPosition() {
    if (!acEl || !acInput || !acInput.isConnected) return;
    const r = acInput.getBoundingClientRect();
    const v = acViewport();

    const width = Math.min(Math.max(r.width, 260), v.w - AC_MARGIN * 2);
    let left = r.left - v.x;
    if (left + width > v.w - AC_MARGIN) left = v.w - width - AC_MARGIN;
    if (left < AC_MARGIN) left = AC_MARGIN;

    // Always drop below the field — never flip above it, never cover what is
    // being typed. The list gets whatever room is left under the field and
    // scrolls inside that box rather than spilling off the screen.
    const cap = Math.min(Math.round(v.h * 0.4), 300);
    const maxH = Math.max(Math.min(acRoomBelow(r, v), cap), 0);

    acEl.style.width = width + 'px';
    acEl.style.left = (left + v.x) + 'px';
    acEl.style.top = (r.bottom + AC_GAP) + 'px';
    acEl.style.maxHeight = maxH + 'px';
  }

  // If the keyboard has left almost no room under the field, scroll the field
  // up instead of shrinking the list to nothing. One nudge per focus, so the
  // scroll handler cannot chase itself in a loop.
  let acNudged = false;
  function acEnsureRoom() {
    if (acNudged || !acInput || !acInput.isConnected) return;
    if (acRoomBelow(acInput.getBoundingClientRect(), acViewport()) >= AC_MIN_ROOM) return;
    acNudged = true;
    if (acInput.scrollIntoView) acInput.scrollIntoView({ block: 'center' });
  }
  function acShow() {
    if (!acEl) return;
    if (!acMatches.length) { acHide(); return; }
    acEl.innerHTML = acMatches.map((it, i) =>
      '<div class="rl-ac-opt' + (i === acActive ? ' active' : '') + '" data-i="' + i + '">' +
        '<span class="rl-ac-desc">' + esc(it.d) + '</span>' +
        '<span class="rl-ac-code">' + esc(it.c) + '</span>' +
      '</div>').join('');
    acEl.style.display = 'block';
    acPosition();
    if (acActive >= 0) {
      const active = acEl.querySelector('.rl-ac-opt.active');
      if (active && active.scrollIntoView) active.scrollIntoView({ block: 'nearest' });
    }
  }
  function acChoose(i) {
    const it = acMatches[i];
    if (!it || !acInput) { acHide(); return; }
    const editor = acInput.getAttribute('data-editor');
    const idx = parseInt(acInput.getAttribute('data-index'), 10);
    const list = editor === 'floor'
      ? (state.floorEditing && state.floorEditing.items)
      : (state.editing && state.editing.items);
    if (list && list[idx]) { list[idx].sku = it.c; list[idx].description = it.d; }
    acHide();
    render();
  }
  function isCatInput(t) { return t && t.classList && t.classList.contains('rl-cat-input'); }

  function setupCatalogAutocomplete() {
    if (window.__rlAcSetup) return;
    window.__rlAcSetup = true;

    if (!document.getElementById('rl-ac-styles')) {
      const st = document.createElement('style');
      st.id = 'rl-ac-styles';
      st.textContent =
        ".rl-ac { position: fixed; z-index: 9999; max-height: 50vh; overflow-y: auto;" +
        " background: #FFF; border: 1px solid #C7C2B2; border-radius: 10px;" +
        " box-shadow: 0 18px 44px rgba(0,0,0,0.28); -webkit-overflow-scrolling: touch;" +
        " overscroll-behavior: contain; touch-action: pan-y; padding: 4px; }" +
        ".rl-ac-opt { display: flex; flex-direction: column; gap: 2px; padding: 11px 13px;" +
        " border-radius: 7px; cursor: pointer; border-bottom: 1px solid #F0EDE4; }" +
        ".rl-ac-opt:last-child { border-bottom: none; }" +
        ".rl-ac-opt:hover, .rl-ac-opt.active { background: #FBEAE7; }" +
        ".rl-ac-opt:active { background: #F6D9D3; }" +
        ".rl-ac-desc { font-family: 'Inter', sans-serif; font-size: 14px; color: #1E1E1C; line-height: 1.25; }" +
        ".rl-ac-code { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #8E2A20; font-weight: 700; }" +
        "@media (max-width: 760px) {" +
        " .rl-ac { max-height: 40vh; border-radius: 12px; border-width: 2px; box-shadow: 0 16px 40px rgba(0,0,0,0.3); }" +
        " .rl-ac-opt { padding: 13px 14px; min-height: 48px; justify-content: center; }" +
        " .rl-ac-desc { font-size: 16px; font-weight: 500; }" +
        " .rl-ac-code { font-size: 12.5px; } }";
      document.head.appendChild(st);
    }

    acEl = document.createElement('div');
    acEl.id = 'rl-ac';
    acEl.className = 'rl-ac';
    acEl.style.display = 'none';
    document.body.appendChild(acEl);

    const refresh = (t) => {
      acInput = t; acMatches = catalogMatches(t.value, 40); acActive = -1;
      acShow(); acEnsureRoom();
    };
    document.addEventListener('input', (e) => { if (isCatInput(e.target)) refresh(e.target); });
    document.addEventListener('focusin', (e) => {
      if (!isCatInput(e.target)) return;
      acNudged = false; // a new field gets its own nudge allowance
      refresh(e.target);
    });

    // Distinguish a tap (select) from a drag (scroll the list): remember the
    // option the touch started on, watch for movement, and only select on lift
    // if the finger stayed put. This lets the list scroll on phones.
    acEl.addEventListener('pointerdown', (e) => {
      acDownOpt = e.target.closest ? e.target.closest('.rl-ac-opt') : null;
      acDownX = e.clientX; acDownY = e.clientY; acDragged = false;
    });
    acEl.addEventListener('pointermove', (e) => {
      if (!acDownOpt) return;
      if (Math.abs(e.clientX - acDownX) > 8 || Math.abs(e.clientY - acDownY) > 8) acDragged = true;
    });
    acEl.addEventListener('pointerup', (e) => {
      const opt = acDownOpt;
      acDownOpt = null;
      if (opt && !acDragged) {
        e.preventDefault();
        acChoose(parseInt(opt.getAttribute('data-i'), 10));
      }
      acDragged = false;
    });
    acEl.addEventListener('pointercancel', () => { acDownOpt = null; acDragged = false; });

    document.addEventListener('keydown', (e) => {
      if (!acInput || !acEl || acEl.style.display === 'none' || !acMatches.length) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); acActive = Math.min(acActive + 1, acMatches.length - 1); acShow(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); acActive = Math.max(acActive - 1, 0); acShow(); }
      else if (e.key === 'Enter' && acActive >= 0) { e.preventDefault(); acChoose(acActive); }
      else if (e.key === 'Escape') { acHide(); }
    });

    // Dismiss on outside tap; keep open when interacting with the box or a catalog input.
    document.addEventListener('pointerdown', (e) => {
      if (!acEl || acEl.style.display === 'none') return;
      if (acEl.contains(e.target) || e.target === acInput || isCatInput(e.target)) return;
      acHide();
    }, true);
    const reposition = () => { if (acInput && acInput.isConnected) acPosition(); };
    document.addEventListener('scroll', reposition, true);
    // Keyboards toggling fire resize on phones — reposition, don't hide.
    window.addEventListener('resize', reposition);
    if (window.visualViewport) {
      // Opening the keyboard on iOS *scrolls* the visual viewport as well as
      // resizing it; without the scroll hook the list is left behind off-page.
      // The resize is also the moment the keyboard actually appears, which is
      // when a field near the bottom may need nudging up to make room.
      window.visualViewport.addEventListener('resize', () => { reposition(); acEnsureRoom(); });
      window.visualViewport.addEventListener('scroll', reposition);
    }
  }

  /* ---------------- AUDIT TRAIL ---------------- */
  const AUDIT_KEY = 'wh-audit-log';
  const AUDIT_MAX = 600;
  let auditLog = [];
  const CURRENT_USER = window.DAMEN_USER || 'Buyer';
  async function loadAudit() {
    try {
      const r = await STORE.get(AUDIT_KEY).catch(() => null);
      auditLog = r ? JSON.parse(r.value) : [];
    } catch (e) { auditLog = []; }
    if (!Array.isArray(auditLog)) auditLog = [];
  }
  async function saveAudit() {
    try { await STORE.set(AUDIT_KEY, JSON.stringify(auditLog.slice(0, AUDIT_MAX))); }
    catch (e) { console.error('Failed to save audit log', e); }
  }
  function logAudit(action, detail) {
    auditLog.unshift(Object.assign({ t: Date.now(), u: CURRENT_USER, a: action }, detail || {}));
    if (auditLog.length > AUDIT_MAX) auditLog.length = AUDIT_MAX;
    saveAudit();
  }
  function itemKeyOf(it) { return (it.sku || '').trim().toUpperCase() + '|' + (it.description || '').trim().toUpperCase(); }
  function tallyItems(list) {
    const out = {};
    (list || []).forEach(it => {
      const k = itemKeyOf(it);
      if (!k.replace('|', '')) return;
      if (!out[k]) out[k] = { sku: (it.sku || '').trim(), description: (it.description || '').trim(), qty: 0 };
      out[k].qty += (parseInt(it.quantity, 10) || 0);
    });
    return out;
  }
  // Writes one audit entry per real change between a slot's old and new contents.
  function logItemDiff(loc, whName, before, after) {
    const b = tallyItems(before), a = tallyItems(after);
    const keys = {};
    Object.keys(b).forEach(k => keys[k] = 1);
    Object.keys(a).forEach(k => keys[k] = 1);
    Object.keys(keys).forEach(k => {
      const ob = b[k], oa = a[k];
      if (!ob && oa) logAudit('added', { loc, wh: whName, sku: oa.sku, desc: oa.description, qty: oa.qty });
      else if (ob && !oa) logAudit('removed', { loc, wh: whName, sku: ob.sku, desc: ob.description, qty: ob.qty });
      else if (ob && oa && ob.qty !== oa.qty) logAudit('qty', { loc, wh: whName, sku: oa.sku, desc: oa.description, qty: oa.qty, prevQty: ob.qty });
    });
  }
  function auditActionLabel(a) {
    return a === 'added' ? 'Added' : a === 'removed' ? 'Removed' : a === 'qty' ? 'Qty changed'
      : a === 'moved' ? 'Moved' : a === 'swapped' ? 'Swapped' : a === 'cleared' ? 'Cleared' : a;
  }
  function auditActionColor(a) {
    return a === 'added' ? '#3F7D4E' : a === 'removed' || a === 'cleared' ? '#B33A2E'
      : a === 'qty' ? '#B07A12' : '#2E5AB8';
  }
  function timeAgo(ts) {
    const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
    if (s < 60) return 'just now';
    const m = Math.round(s / 60); if (m < 60) return m + ' min ago';
    const h = Math.round(m / 60); if (h < 24) return h + ' h ago';
    const d = Math.round(h / 24); if (d < 8) return d + ' d ago';
    return new Date(ts).toLocaleDateString();
  }

  function defaultRowsFor(wh) {
    return wh.rackIds.map(id => ({ id, name: 'Rack #' + id, palletsPerColumn: 2 }));
  }

  function idSort(a, b) { return String(a).localeCompare(String(b), undefined, { numeric: true }); }

  async function loadWarehouseData(whId) {
    const wh = WAREHOUSES[whId];
    const prefix = wh.storagePrefix || '';
    let rows, data, floorData;

    try {
      const rowsRes = await STORE.get(prefix + 'rack-rows').catch(() => null);
      rows = rowsRes ? JSON.parse(rowsRes.value) : defaultRowsFor(wh);
    } catch (e) { rows = defaultRowsFor(wh); }

    try {
      const dataRes = await STORE.get(prefix + 'rack-data').catch(() => null);
      data = dataRes ? JSON.parse(dataRes.value) : {};
    } catch (e) { data = {}; }

    try {
      const floorRes = await STORE.get(prefix + 'floor-data').catch(() => null);
      floorData = floorRes ? JSON.parse(floorRes.value) : {};
    } catch (e) { floorData = {}; }

    if (!rows.length) rows = defaultRowsFor(wh);
    const expectedIds = [...wh.rackIds].sort(idSort);
    const storedIds = rows.map(r => r.id).sort(idSort);
    if (JSON.stringify(storedIds) !== JSON.stringify(expectedIds)) rows = defaultRowsFor(wh);

    // drop any saved pallet data sitting on slots that don't really exist in this warehouse's layout
    Object.keys(data).forEach(rowId => {
      Object.keys(data[rowId]).forEach(code => {
        const [level, pos] = code.split('-');
        const l = wh.layout[rowId];
        const exists = !!l && l.exists.has(level + '-' + pos);
        if (!exists) { delete data[rowId][code]; return; }
        const v = data[rowId][code];
        if (v && !Array.isArray(v)) data[rowId][code] = [v]; // migrate old single-object format
      });
    });

    whCache[whId] = { rows, data, floorData };
    return whCache[whId];
  }

  async function loadState() {
    await Promise.all(Object.keys(WAREHOUSES).map(loadWarehouseData));
    await loadAudit();
    state.ready = true;
    render();
  }

  function storageKey(base) { return (CURRENT_WH.storagePrefix || '') + base; }

  async function saveRows() {
    try { await STORE.set(storageKey('rack-rows'), JSON.stringify(state.rows)); }
    catch (e) { console.error('Failed to save rows', e); }
  }
  // Every pallet/floor write must reach the shared inventory (window.storage ->
  // server action -> inventory_placements). If the server says it didn't sync,
  // warn loudly instead of failing silently, so an entry is never quietly left
  // on one device instead of the general warehouse inventory.
  async function persist(key, value, label) {
    try {
      const res = await STORE.set(key, value);
      if (res && res.ok === false) {
        console.error('Inventory save rejected:', res.error);
        showFlash('⚠ ' + label + ' did not sync to the main inventory — check your connection and try again.');
        return false;
      }
      return true;
    } catch (e) {
      console.error('Failed to save ' + label, e);
      showFlash('⚠ ' + label + ' failed to sync to the main inventory.');
      return false;
    }
  }
  async function saveData() {
    await persist(storageKey('rack-data'), JSON.stringify(state.data), 'Pallet update');
  }
  async function saveDataForWarehouse(whId) {
    const wh = WAREHOUSES[whId];
    await persist((wh.storagePrefix || '') + 'rack-data', JSON.stringify(whCache[whId].data), 'Pallet update');
  }
  async function saveFloorData() {
    await persist(storageKey('floor-data'), JSON.stringify(state.floorData), 'Floor update');
  }

  // Before saving an edit, pull the freshest shared copy of this unit so we only
  // change the one slot the user touched and never clobber items other people
  // added while this editor was open (the whole warehouse is one shared list).
  // A failed/empty read is ignored so we never wipe on a hiccup.
  async function mergeRackDataFromServer() {
    const prefix = CURRENT_WH.storagePrefix || '';
    let res = null;
    try { res = await STORE.get(prefix + 'rack-data'); } catch (e) { res = null; }
    if (!res || res.value == null) return false;
    let data;
    try { data = JSON.parse(res.value); } catch (e) { return false; }
    if (!data || typeof data !== 'object') return false;
    Object.keys(data).forEach(rowId => {
      Object.keys(data[rowId] || {}).forEach(code => {
        const [level, pos] = code.split('-');
        const l = CURRENT_WH.layout[rowId];
        if (!l || !l.exists.has(level + '-' + pos)) { delete data[rowId][code]; return; }
        const v = data[rowId][code];
        if (v && !Array.isArray(v)) data[rowId][code] = [v];
      });
    });
    state.data = data;
    if (whCache[state.warehouseId]) whCache[state.warehouseId].data = data;
    return true;
  }
  async function mergeFloorDataFromServer() {
    const prefix = CURRENT_WH.storagePrefix || '';
    let res = null;
    try { res = await STORE.get(prefix + 'floor-data'); } catch (e) { res = null; }
    if (!res || res.value == null) return false;
    let data;
    try { data = JSON.parse(res.value); } catch (e) { return false; }
    if (!data || typeof data !== 'object') return false;
    state.floorData = data;
    if (whCache[state.warehouseId]) whCache[state.warehouseId].floorData = data;
    return true;
  }

  async function switchWarehouse(whId) {
    const wh = WAREHOUSES[whId];
    if (!wh) return;
    if (!whCache[whId]) await loadWarehouseData(whId);
    const cache = whCache[whId];
    CURRENT_WH = wh;
    RACK_IDS = wh.rackIds;
    RACK_LAYOUT = wh.layout;
    FLOOR_IDS = wh.floorIds;
    state.warehouseId = whId;
    state.rows = cache.rows;
    state.data = cache.data;
    state.floorData = cache.floorData;
    state.activeRowId = cache.rows[0] ? cache.rows[0].id : null;
    state.screen = 'overview';
    render();
  }

  function floorItems(floorId) { return state.floorData[floorId] || []; }
  function setFloorItems(floorId, items) {
    // Keep emptied areas as [] so a save still conveys "now empty" (see setCellItems).
    state.floorData[floorId] = items || [];
  }

  function getRow(id) { return state.rows.find(r => r.id === id); }
  function cellItems(rowId, code) {
    return (state.data[rowId] && state.data[rowId][code]) || [];
  }
  function setCellItems(rowId, code, items) {
    if (!state.data[rowId]) state.data[rowId] = {};
    // Keep emptied slots as [] (don't drop the key) so a save still tells the
    // server "this location is now empty" — otherwise, under location-scoped
    // saving, clearing a slot wouldn't remove its items.
    state.data[rowId][code] = items || [];
  }

  function updateRowField(rowId, field, value) {
    const row = getRow(rowId);
    if (!row) return;
    row[field] = value;
    saveRows();
    render();
  }

  function openEditor(rowId, level, pos) {
    const code = level + '-' + pos;
    const items = cellItems(rowId, code).map(i => ({ sku: i.sku || '', description: i.description || '', quantity: i.quantity != null ? i.quantity : 1 }));
    // An item picked from the catalog ("place this somewhere") lands here pre-filled.
    if (state.placing && items.length < MAX_ITEMS) {
      items.push({ sku: state.placing.sku, description: state.placing.description, quantity: 1 });
    }
    state.editing = {
      rowId, level, pos, items, showMove: false, moveTarget: { whId: state.warehouseId, rowId, level, pos },
      itemMoveIndex: null, itemMoveTarget: null
    };
    render();
  }
  function closeEditor() {
    state.editing = null;
    render();
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function showFlash(msg) {
    state.flash = msg;
    render();
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => { state.flash = null; render(); }, 2400);
  }

  // Strips the internal depth suffix (a/b/c) from a position or full location string for
  // display, and looks up its human tag using the rack's actual depth count — e.g. for a
  // 3-deep rack, "1b" -> {clean:"1", tag:"Middle", suffix:"b"}; for a 2-deep rack,
  // "1b" -> {clean:"1", tag:"Rear", suffix:"b"}.
  function depthInfo(rackId, str) {
    const m = String(str).match(/^(.*\d)([abc])$/);
    if (!m) return { clean: String(str), tag: '', suffix: '' };
    return { clean: m[1], tag: depthTagFor(rackId, m[2]), suffix: m[2] };
  }

  // "15-B-3" style display label for a rack slot, with the depth suffix kept only when it matters.
  function fullLoc(rowId, level, pos) {
    const di = depthInfo(rowId, rowId + '-' + level + '-' + pos);
    return di.clean + (di.tag && di.tag !== 'Front' ? di.suffix : '');
  }

  function rackFillStats(row) {
    const total = (RACK_LAYOUT[row.id] && RACK_LAYOUT[row.id].exists.size) || 0;
    let filled = 0;
    const d = state.data[row.id] || {};
    Object.keys(d).forEach(code => { if (d[code] && d[code].length) filled++; });
    return { filled, total };
  }

  /* ---------------- OVERVIEW ---------------- */
  function renderOverviewDry() {
    const vaisle = (label, floorId, grow) => {
      const count = floorId ? floorItems(floorId).length : 0;
      const clickAttr = floorId ? `class="rl-vaisle rl-vaisle-clickable" onclick="RL.openFloorEditor(${floorId})" title="${esc(label)} — click to log pallets stored on the floor here"` : `class="rl-vaisle"`;
      return `
      <div ${clickAttr} style="${grow ? 'flex:1 1 0;' : ''}">
        <div class="rl-vaisleline"></div>
        <div class="rl-vaislelabel">${esc(label)}${count ? ` · ${count}` : ''}</div>
        <div class="rl-vaisleline"></div>
      </div>`;
    };
    const pair = (a, b, divider, variantA, variantB) => `
      <div class="rl-pairgroup ${(variantA === 'thin' || variantB === 'thin') ? 'rl-thinpair' : ''}">
        ${runWrap(getRow(a), 'v', 'flex:0 0 80px; min-height:480px;', 480)}
        ${divider === 'wall'
          ? `<div class="rl-wall" title="Wall"><div class="rl-wallline"></div></div>`
          : `<div class="rl-pairbrace" title="Shared back-to-back frame"></div>`}
        ${runWrap(getRow(b), 'v', 'flex:0 0 80px; min-height:480px;', 480)}
      </div>`;
    const wall = `<div class="rl-wall" title="Wall"><div class="rl-wallline"></div></div>`;
    const rack5Corner = `
      <div class="rl-cornerwrap" style="flex-direction:column;">
        <div style="flex:1 1 0; min-height:0; width:100%; display:flex; flex-direction:column; align-items:center; justify-content:flex-start;">
          <div style="width:100%; height:82%; border:2px dashed #A6A398; border-radius:8px; background:#DCEAF5; display:flex; align-items:center; justify-content:center; font-family:'JetBrains Mono', monospace; font-weight:700; font-size:18px; color:#6B6A62; text-transform:uppercase; letter-spacing:0.5px; cursor:pointer;" onclick="RL.enterWarehouse('freezer')" title="Freezer">Freezer</div>
        </div>
        <div style="flex:0 0 150px; width:100%; display:flex; align-items:stretch;">
          <div class="rl-cornerspacer"></div>
          ${runWrap(getRow(5), 'v', 'flex:1 1 0; min-width:0;', 150)}
        </div>
      </div>`;

    // Rack #17 now runs full height to the top wall. Rack #16 sits only above the
    // (widened) Floor 3 aisle, between Rack #17 and Rack #15.
    const floor3Group = `
      <div class="rl-capgroup">
        ${runWrap(getRow(16), 'h', 'flex:0 0 auto; min-height:90px;', 73)}
        ${vaisle('Floor 3', 3, true)}
      </div>`;

    const mainHtml = runWrap(getRow(17), 'v', 'flex:0 0 80px; min-height:480px;', 480) + floor3Group + pair(15, 13, null, 'thin', 'thin') + vaisle('Floor 2', 1.5) + pair(12, 11, 'wall', 'thin', 'thin')
      + vaisle('Floor 1', 1) + runWrap(getRow(10), 'v', 'flex:0 0 80px; min-height:480px;', 480) + wall + rack5Corner;

    // Everything below is sized with proportional flex weights (not fixed pixels) so the
    // blueprint always exactly fills the card at any width — no horizontal scrolling ever.
    // Rack #14's offset/width weights (1.9 / 2.55) mirror Rack17+Floor3 and Pair15/13+Floor2
    // above it, so its right edge always lands exactly where Rack #12 begins.
    return `
      <div class="rl-warehouse">
        <div class="rl-blueprint-scroll">
        <div class="rl-blueprintbody" style="border:3px solid #2A2925; border-radius:6px; padding:6px; box-sizing:border-box;">
          <div class="rl-mainrow">${mainHtml}</div>
          <div class="rl-haisle">
            <div class="rl-haisleline"></div>
            <div class="rl-haiselabel">Aisle</div>
            <div class="rl-haisleline"></div>
          </div>
          <div class="rl-bottomrow">
            <div class="rl-bottomspacer" style="display:flex; align-items:stretch; justify-content:center;">${dockDoorHtml('Dock — west of Rack #14')}</div>
            ${runWrap(getRow(14), 'h', 'width:100%; min-height:90px; flex:2 1 0;', 420)}
            <div class="rl-bottomtrailer" style="display:flex; align-items:stretch;">
              <div style="flex:0.287 1 0; min-width:0; display:flex; align-items:stretch; justify-content:center;">${dockDoorHtml('Dock — between Rack #14 and Rack #11', 80)}</div>
              <div class="rl-wall" title="Wall"><div class="rl-wallline"></div></div>
              <div style="flex:1 1 0; min-width:0; display:flex; align-items:stretch; gap:10px; padding:0 10px; justify-content:flex-end;">
                <div style="flex:0 0 140px; display:flex; align-items:stretch; margin-right:60px;">${dockDoorHtml('Dock — under Rack #10')}</div>
                <div style="flex:0 0 140px; display:flex; align-items:stretch; margin-left:20px;">${dockDoorHtml('Dock — under Rack #5')}</div>
              </div>
            </div>
          </div>
        </div>
        </div>
      </div>`;
  }

  // Freezer plan, from the hand-drawn sketch: Rack #33 alone, a Floor 3 aisle, Rack #32+31
  // back-to-back (shared frame), a Floor 2 aisle, Rack #30 alone — and below that, a
  // Returns / Floor 1 strip separated by a divider.
  function renderOverviewFreezer() {
    // Fixed (non-growing) widths — nothing here stretches to fill leftover row space, so
    // racks stay exactly this size no matter what the floor cells do.
    const floorCell = (label, floorId) => `
      <div class="rl-vaisle rl-vaisle-clickable" onclick="RL.openFloorEditor('${floorId}')" title="${esc(label)} — click to log pallets stored here" style="flex:1.5 1 0; min-height:450px; padding:8px 0;">
        <div class="rl-vaisleline"></div>
        <div class="rl-vaislelabel" style="writing-mode:horizontal-tb; letter-spacing:1.5px; font-size:13px;">${esc(label)}${floorItems(floorId).length ? ` · ${floorItems(floorId).length}` : ''}</div>
        <div class="rl-vaisleline"></div>
      </div>`;
    const thinRack = (id) => `
      <div style="flex:0 0 80px; min-width:0; min-height:450px;">${rackRunHtml(getRow(id), 'v', 450)}</div>`;
    const brace = `<div class="rl-pairbrace" title="Shared back-to-back frame"></div>`;
    const stripCell = (label, floorId) => `
      <div class="rl-vaisle rl-vaisle-clickable" onclick="RL.openFloorEditor('${floorId}')" title="${esc(label)} — click to log pallets stored here" style="flex:1 1 0; min-height:52px; padding:8px 0;">
        <div class="rl-vaisleline"></div>
        <div class="rl-vaislelabel" style="writing-mode:horizontal-tb; letter-spacing:1.5px; font-size:13px;">${esc(label)}${floorItems(floorId).length ? ` · ${floorItems(floorId).length}` : ''}</div>
        <div class="rl-vaisleline"></div>
      </div>`;

    // Racks 33/32/31/30 are a fixed 137px each — this never changes regardless of Floor
    // 3/Floor 2's width. Floor 3 and Floor 2 are now a fixed 130px (thinner than before);
    // the row no longer stretches to fill the card, which is fine — compact is the goal.
    const mainHtml = thinRack(33)
      + floorCell('Floor 3', 'floor3')
      + thinRack(32) + brace + thinRack(31)
      + floorCell('Floor 2', 'floor2')
      + thinRack(30);

    return `
      <div class="rl-warehouse" style="width:565px; max-width:100%; box-sizing:border-box; overflow:hidden; margin:0 auto;">
        <div class="rl-blueprint-scroll">
        <div class="rl-blueprintbody" style="width:fit-content; min-width:0; margin:0 auto; border:3px solid #2A2925; border-radius:6px; padding:6px; box-sizing:border-box;">
          <div class="rl-mainrow">${mainHtml}</div>
          <div class="rl-haisle">
            <div class="rl-haisleline"></div>
            <div class="rl-haiselabel">Aisle</div>
            <div class="rl-haisleline"></div>
          </div>
          <div class="rl-bottomrow" style="max-width:760px; align-items:stretch; margin-left:auto;">
            <div style="flex:0 0 110px; display:flex; align-items:center; justify-content:flex-start; margin-right:24px;">
              <div style="width:100%; height:32px; box-sizing:border-box; border:2px dashed #A6A398; border-radius:6px; background:#F7F5EF; display:flex; align-items:center; justify-content:center; font-family:'JetBrains Mono', monospace; font-weight:700; font-size:10px; color:#6B6A62; text-transform:uppercase; letter-spacing:0.5px;" title="Door — next to Returns">Door</div>
            </div>
            <div class="rl-pairgroup">
              <div style="flex:1 1 0; min-width:0; display:flex; align-items:stretch; border:2px dotted #C0392B; border-radius:8px; box-sizing:border-box;">${stripCell('Returns', 'returns')}</div>
              <div class="rl-pairbrace" title="Divider"></div>
              <div style="flex:1 1 0; min-width:0; display:flex; align-items:stretch; border:2px dotted #C0392B; border-radius:8px; box-sizing:border-box;">${stripCell('Floor 1', 'floor1')}</div>
            </div>
          </div>
        </div>
        </div>
      </div>`;
  }

  // Fridge 40 plan, from the hand-drawn sketch: Floor #2 (top-left) sits beside Rack #41
  // (wide, top-right). Rack #41 and Rack #40 share a physical frame (the X mark) — Rack #41
  // on top, Rack #40 directly below. Rack #42 (bottom-left) sits under Floor #2, next to the
  // Floor 1 area, which sits under the right half of Rack #41.
  function renderOverviewFridge40() {
    const cell = (label, floorId, flexWeight) => `
      <div class="rl-vaisle rl-vaisle-clickable" onclick="RL.openFloorEditor('${floorId}')" title="${esc(label)} — click to log pallets stored here" style="flex:${flexWeight} 1 0; min-height:70px; padding:8px 0;">
        <div class="rl-vaisleline"></div>
        <div class="rl-vaislelabel" style="writing-mode:horizontal-tb; letter-spacing:1.5px; font-size:13px;">${esc(label)}${floorItems(floorId).length ? ` · ${floorItems(floorId).length}` : ''}</div>
        <div class="rl-vaisleline"></div>
      </div>`;
    const emptyCross = `
      <div style="flex:0.5 1 0; min-width:0; display:flex;">
        <div class="rl-emptycross" style="width:30%; margin-right:auto;" title="Shared frame with Rack #40 below — no storage here"></div>
      </div>`;

    return `
      <div class="rl-warehouse" style="width:461px; max-width:100%; box-sizing:border-box; overflow:hidden; margin:0 auto;">
        <div class="rl-blueprint-scroll" style="overflow:hidden;">
        <div class="rl-blueprintbody" style="width:807px; margin-left:-200px;">
          <div style="position:relative; padding:6px 0; box-sizing:border-box; display:flex; flex-direction:column; gap:6px;">
            <div style="position:absolute; left:calc(27% - 12px); right:calc(27% - 6px); top:0; height:3px; background:#2A2925;"></div>
            <div style="position:absolute; left:calc(27% - 12px); right:calc(27% - 6px); bottom:0; height:3px; background:#2A2925;"></div>
            <div style="position:absolute; left:calc(27% - 12px); top:0; bottom:0; width:3px; background:#2A2925;"></div>
            <div style="position:absolute; left:calc(73% + 6px); top:0; bottom:0; width:3px; background:#2A2925;"></div>
          <div class="rl-mainrow" style="align-items:stretch;">
            <div style="flex:0.5 1 0; min-width:0; display:flex;">
              <div style="width:30%; margin-left:auto; display:flex; align-items:stretch; border:2px dotted #C0392B; border-radius:8px; box-sizing:border-box;">${cell('Floor #2', 'floor2', 1)}</div>
            </div>
            <div style="flex:0.3 1 0; min-width:0; min-height:70px;">${rackRunHtml(getRow(41), 'h', 300)}</div>
            ${emptyCross}
          </div>
          <div class="rl-mainrow" style="align-items:stretch;">
            <div style="flex:0.5 1 0; min-width:0; display:flex;"><div style="width:30%; margin-left:auto; min-height:250px;">${rackRunHtml(getRow(42), 'v', 300)}</div></div>
            ${cell('Floor 1', 'floor1', 0.3)}
            <div style="flex:0.5 1 0; min-width:0; display:flex;"><div style="width:30%; margin-right:auto; min-height:250px;">${rackRunHtml(getRow(40), 'v', 300)}</div></div>
          </div>
          <div style="position:absolute; bottom:0; left:50%; transform:translateX(-50%); width:64px; height:28px;">
              <div style="width:100%; height:100%; box-sizing:border-box; border:2px dashed #A6A398; border-radius:6px; background:#F7F5EF; display:flex; align-items:center; justify-content:center; font-family:'JetBrains Mono', monospace; font-weight:700; font-size:9px; color:#6B6A62; text-transform:uppercase; letter-spacing:0.5px;" title="Door — south exit, off Floor 1">Door</div>
          </div>
          </div>
        </div>
        </div>
      </div>`;
  }


  // Fridge 50 plan, from the hand-drawn sketch — same sizing as Fridge 40: Floor 3
  // (top-left) sits beside Rack #51 (wide, top-center); Floor 2 (top-right) sits over
  // Rack #50 below it (shared frame). Rack #52 (bottom-left) sits next to Floor 1
  // (bottom-center), which sits under Rack #51.
  function renderOverviewFridge50() {
    const cell = (label, floorId, flexWeight) => `
      <div class="rl-vaisle rl-vaisle-clickable" onclick="RL.openFloorEditor('${floorId}')" title="${esc(label)} — click to log pallets stored here" style="flex:${flexWeight} 1 0; min-height:70px; padding:8px 0;">
        <div class="rl-vaisleline"></div>
        <div class="rl-vaislelabel" style="writing-mode:horizontal-tb; letter-spacing:1.5px; font-size:13px;">${esc(label)}${floorItems(floorId).length ? ` · ${floorItems(floorId).length}` : ''}</div>
        <div class="rl-vaisleline"></div>
      </div>`;

    return `
      <div class="rl-warehouse" style="width:461px; max-width:100%; box-sizing:border-box; overflow:hidden; margin:0 auto;">
        <div class="rl-blueprint-scroll" style="overflow:hidden;">
        <div class="rl-blueprintbody" style="margin-left:-200px; width:807px;">
          <div style="position:relative; padding:6px 0; box-sizing:border-box; display:flex; flex-direction:column; gap:6px;">
            <div style="position:absolute; left:calc(27% - 12px); right:calc(27% - 6px); top:0; height:3px; background:#2A2925;"></div>
            <div style="position:absolute; left:calc(27% - 12px); right:calc(27% - 6px); bottom:0; height:3px; background:#2A2925;"></div>
            <div style="position:absolute; left:calc(27% - 12px); top:0; bottom:0; width:3px; background:#2A2925;"></div>
            <div style="position:absolute; left:calc(73% + 6px); top:0; bottom:0; width:3px; background:#2A2925;"></div>
          <div class="rl-mainrow" style="align-items:stretch;">
            <div style="flex:0.5 1 0; min-width:0; display:flex;">
              <div style="width:30%; margin-left:auto; display:flex; align-items:stretch; border:2px dotted #C0392B; border-radius:8px; box-sizing:border-box;">${cell('Floor 3', 'floor3', 1)}</div>
            </div>
            <div style="flex:0.3 1 0; min-width:0; min-height:70px;">${rackRunHtml(getRow(51), 'h', 300)}</div>
            <div style="flex:0.5 1 0; min-width:0; display:flex;">
              <div style="width:30%; margin-right:auto; display:flex; align-items:stretch; border:2px dotted #C0392B; border-radius:8px; box-sizing:border-box;">${cell('Floor 2', 'floor2', 1)}</div>
            </div>
          </div>
          <div class="rl-mainrow" style="align-items:stretch;">
            <div style="flex:0.5 1 0; min-width:0; display:flex;"><div style="width:30%; margin-left:auto; min-height:250px;">${rackRunHtml(getRow(52), 'v', 300)}</div></div>
            ${cell('Floor 1', 'floor1', 0.3)}
            <div style="flex:0.5 1 0; min-width:0; display:flex;"><div style="width:30%; margin-right:auto; min-height:250px;">${rackRunHtml(getRow(50), 'v', 300)}</div></div>
          </div>
          <div style="position:absolute; bottom:0; left:50%; transform:translateX(-50%); width:64px; height:28px;">
              <div style="width:100%; height:100%; box-sizing:border-box; border:2px dashed #A6A398; border-radius:6px; background:#F7F5EF; display:flex; align-items:center; justify-content:center; font-family:'JetBrains Mono', monospace; font-weight:700; font-size:9px; color:#6B6A62; text-transform:uppercase; letter-spacing:0.5px;" title="Door — south exit, off Floor 1">Door</div>
          </div>
          </div>
        </div>
        </div>
      </div>`;
  }


  // Fridge 60 plan, from the hand-drawn sketch — same sizing as Fridge 40: Floor 2
  // (top-left, small) sits beside Rack #60 (long, spans the top). Below: Rack #62 (tall,
  // full-height, left) sits beside the Floor 1 aisle (spans the full height, with a Door
  // branching off to the far right at the top); the right column stacks Rack #61 (short,
  // wide, top) over Rack #63 (tall, bottom). A second Door sits below Rack #62.
  function renderOverviewFridge60() {
    const cell = (label, floorId, flexWeight) => `
      <div class="rl-vaisle rl-vaisle-clickable" onclick="RL.openFloorEditor('${floorId}')" title="${esc(label)} — click to log pallets stored here" style="flex:${flexWeight} 1 0; min-height:70px; padding:8px 0;">
        <div class="rl-vaisleline"></div>
        <div class="rl-vaislelabel" style="writing-mode:horizontal-tb; letter-spacing:1.5px; font-size:13px;">${esc(label)}${floorItems(floorId).length ? ` · ${floorItems(floorId).length}` : ''}</div>
        <div class="rl-vaisleline"></div>
      </div>`;
    const doorBox = title => `
      <div style="width:100%; height:100%; min-height:0; box-sizing:border-box; border:2px dashed #A6A398; border-radius:6px; background:#F7F5EF; display:flex; align-items:center; justify-content:center; font-family:'JetBrains Mono', monospace; font-weight:700; font-size:9px; color:#6B6A62; text-transform:uppercase; letter-spacing:0.5px; overflow:hidden;" title="${esc(title)}">Door</div>`;

    return `
      <div class="rl-warehouse" style="width:603px; max-width:100%; box-sizing:border-box; overflow:hidden; margin:0 auto;">
        <div class="rl-blueprint-scroll" style="overflow:hidden;">
        <div class="rl-blueprintbody" style="display:flex; flex-direction:column; gap:6px; width:807px;">
          <div style="position:relative; display:flex; flex-direction:column; gap:6px; border-radius:0 0 0 6px; padding:6px 0 6px 12px; box-sizing:border-box;">
            <div style="position:absolute; left:6px; top:0; width:66%; height:3px; background:#2A2925;"></div>
            <div style="position:absolute; left:6px; bottom:0; width:66%; height:3px; background:#2A2925;"></div>
            <div style="position:absolute; left:6px; top:0; bottom:0; width:3px; background:#2A2925;"></div>
            <div style="position:absolute; left:calc(66% + 6px); top:0; bottom:0; width:3px; background:#2A2925;"></div>
          <div class="rl-mainrow" style="align-items:stretch; flex:0 0 auto;">
            <div style="flex:0.22 1 0; min-width:0; display:flex; align-items:stretch; border:2px dotted #C0392B; border-radius:8px; box-sizing:border-box;">${cell('Floor 2', 'floor2', 1)}</div>
            <div style="flex:1.1 1 0; min-width:0; min-height:76px; padding-right:6px; box-sizing:border-box;">${rackRunHtml(getRow(60), 'h', 620)}</div>
            <div style="flex:0.68 1 0; min-width:0;"></div>
          </div>
          <div class="rl-mainrow" style="align-items:stretch; flex:0 0 320px; min-height:0;">
            <div style="flex:0.22 1 0; min-width:0;">${rackRunHtml(getRow(62), 'v', 320)}</div>
            <div style="flex:1.6 1 0; min-width:0; position:relative;">
              <div style="position:absolute; top:0; right:38%; width:64px; height:80px; pointer-events:auto; z-index:2;">${doorBox('Door — east exit, off Floor 1')}</div>
              <div class="rl-vaisle-clickable" onclick="RL.openFloorEditor('floor1')" title="Floor 1 — click to log pallets stored here"
                   style="position:absolute; inset:0; clip-path:polygon(0 0, 60.35% 0, 60.35% 25%, 18.75% 25%, 18.75% 100%, 0 100%); cursor:pointer;">
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" style="position:absolute; inset:0; width:100%; height:100%;">
                  <polyline points="60.35,12.5 9.375,12.5 9.375,36" fill="none" stroke="#C0392B" stroke-width="2"
                            stroke-dasharray="2 6" stroke-linecap="round" vector-effect="non-scaling-stroke"></polyline>
                  <polyline points="9.375,53 9.375,100" fill="none" stroke="#C0392B" stroke-width="2"
                            stroke-dasharray="2 6" stroke-linecap="round" vector-effect="non-scaling-stroke"></polyline>
                </svg>
                <div class="rl-vaislelabel" style="position:absolute; left:0; width:18.75%; top:40%; writing-mode:horizontal-tb; letter-spacing:1.5px; font-size:13px; text-align:center;">Floor 1${floorItems('floor1').length ? ` · ${floorItems('floor1').length}` : ''}</div>
              </div>
              <div style="position:absolute; inset:0; display:flex; pointer-events:none;">
                <div style="flex:0 0 18.75%; min-width:0;"></div>
                <div style="flex:1 1 0; min-width:0; display:flex; flex-direction:column; gap:5px;">
                  <div style="display:flex; align-items:stretch; gap:6px; flex:0 0 80px; min-height:0;">
                    <div style="flex:1 1 0; min-width:0;"></div>
                  </div>
                  <div style="flex:0 0 62px; min-height:0; display:flex;"><div style="flex:0 0 51.2%; min-width:0; pointer-events:auto;">${rackRunHtml(getRow(61), 'h', 330)}</div></div>
                  <div style="display:flex; flex:1 1 0; min-height:0;">
                    <div style="flex:0.12 1 0; min-width:0; pointer-events:auto;">${rackRunHtml(getRow(63), 'v', 168)}</div>
                    <div style="flex:0.88 1 0; min-width:0;"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div style="position:absolute; bottom:14px; left:16%; width:64px; height:28px; pointer-events:auto; z-index:2;">${doorBox('Door — south exit, off Floor 1')}</div>
          </div>
        </div>
        </div>
      </div>`;
  }


  function dockDoorHtml(title, widthPx) {
    const style = widthPx ? ` style="flex:0 0 ${widthPx}px;"` : '';
    return `
      <div class="rl-dock"${style} title="${esc(title)}">
        <div class="rl-dock-panel"></div>
        <div class="rl-docklabel">Dock</div>
      </div>`;
  }

  // Realistic top-view racking run — used only by the Fridge 60 overview. Draws the actual
  // steel: two beam rails, uprights at every column boundary, and one pallet footprint per
  // position (planked + wrapped when stocked, hatched void when empty).
  function rackRunHtml(row, orient, availPx) {
    const layout = RACK_LAYOUT[row.id] || { maxPos: 0, levelsOrder: [], exists: new Set() };
    const maxPos = layout.maxPos;
    const levels = layout.levelsOrder || [];
    const vertical = orient === 'v';
    const groups = COLUMN_GROUPS[row.id] || (function() {
      const per = row.palletsPerColumn || 2, out = [];
      for (let p = 1; p <= maxPos; p += per) {
        const g = [];
        for (let k = p; k < p + per && k <= maxPos; k++) g.push(k);
        out.push(g);
      }
      return out;
    })();
    const stocked = pos => levels.some(l => layout.exists.has(l + '-' + pos) && cellItems(row.id, l + '-' + pos).length);
    const depthAt = pos => levels.filter(l => layout.exists.has(l + '-' + pos)).length;
    const { filled, total } = rackFillStats(row);

    const beam = side => `<div style="position:absolute; ${vertical ? (side === 'a' ? 'left:0;' : 'right:0;') + ' top:0; bottom:0; width:7px;' : (side === 'a' ? 'top:0;' : 'bottom:0;') + ' left:0; right:0; height:7px;'} border-radius:2px; background:linear-gradient(${vertical ? '90deg' : '180deg'}, #EF8A3C 0%, #D9662A 55%, #A94A18 100%); box-shadow:inset 0 0 0 1px rgba(0,0,0,0.18);"></div>`;
    // Steel scales with the space actually available along the run, so short runs stay readable —
    // an upright must never out-weigh the pallet footprints it brackets.
    const uprightCount = groups.length + 1;
    const span = availPx || (vertical ? 320 : 900);
    const fit = (up, mg) => (span - uprightCount * up - maxPos * mg * 2) / Math.max(maxPos, 1);
    let upPx = 9, mgPx = 2;
    if (fit(upPx, mgPx) < 12) { upPx = 5; mgPx = 1; }
    if (fit(upPx, mgPx) < 8) { upPx = 4; mgPx = 0; }
    const showNum = fit(upPx, mgPx) >= 10;
    const upright = `<div style="flex:0 0 ${upPx}px; ${vertical ? 'width:100%; height:' + upPx + 'px;' : 'height:100%; width:' + upPx + 'px;'} border-radius:2px; background:linear-gradient(${vertical ? '180deg' : '90deg'}, #6E6B62 0%, #3B3A35 45%, #2A2925 100%); box-shadow:0 0 0 1px rgba(0,0,0,0.25); z-index:2;"></div>`;
    const inset = vertical ? 'margin:' + mgPx + 'px 9px;' : 'margin:9px ' + mgPx + 'px;';

    let bays = '';
    groups.forEach((g, gi) => {
      if (gi === 0) bays += upright;
      g.forEach(pos => {
        const on = stocked(pos);
        const d = depthAt(pos);
        const fillStyle = 'background:repeating-linear-gradient(45deg, #EAE6DA 0 3px, #F7F5EF 3px 7px); box-shadow:inset 0 0 0 1px #D6D1C2;';
        bays += `<div title="${esc(row.name)} · position ${pos} — ${d} level${d === 1 ? '' : 's'}${on ? ' · stocked' : ' · empty'}" style="flex:1 1 0; min-width:0; min-height:0; ${inset} border-radius:2px; ${fillStyle} display:flex; align-items:center; justify-content:center; overflow:hidden;">${showNum ? '<span style="font-family:\'JetBrains Mono\', monospace; font-size:8px; font-weight:700; color:' + (on ? 'rgba(50,38,20,0.75)' : '#B3AF9F') + ';">' + pos + '</span>' : ''}</div>`;
      });
      bays += upright;
    });

    const badge = `<div style="position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); z-index:3; pointer-events:none; display:flex; ${vertical ? 'flex-direction:column;' : ''} align-items:center; gap:4px; padding:${vertical ? '6px 3px' : '3px 8px'}; border-radius:4px; background:#F5C518; box-shadow:0 1px 4px rgba(0,0,0,0.18);${vertical ? ' writing-mode:vertical-rl;' : ''}">
        <span style="font-family:'Barlow Condensed', sans-serif; font-weight:700; font-size:28px; line-height:1; letter-spacing:0.5px; text-transform:uppercase; color:#1E1E1C; white-space:nowrap;">${esc(String(row.name).replace(/^\s*rack\s*/i, ''))}</span>
        <span style="font-family:'JetBrains Mono', monospace; font-size:14px; font-weight:700; line-height:1; color:#B33A2E; white-space:nowrap;">${filled}/${total}</span>
      </div>`;

    return `
      <div class="rl-rackrun" onclick="RL.goToRack(${row.id})" title="${esc(row.name)} — ${filled}/${total} pallets stocked. Click to open."
           style="position:relative; box-sizing:border-box; width:100%; height:100%; ${vertical ? 'min-width:44px;' : 'min-height:56px;'} cursor:pointer; padding:${vertical ? '0 1px' : '1px 0'};">
        ${beam('a')}${beam('b')}
        <div style="position:relative; z-index:1; width:100%; height:100%; display:flex; ${vertical ? 'flex-direction:column;' : ''} align-items:stretch;">${bays}</div>
        ${badge}
      </div>`;
  }

  // Wraps a Fridge-60-style realistic rack run in a sized flex container, for reuse across
  // all warehouse overviews (matches the old rackBlockHtml's outer sizing so layouts hold).
  function runWrap(row, orient, style, availPx) {
    return `<div style="box-sizing:border-box; ${style}">${rackRunHtml(row, orient, availPx)}</div>`;
  }

  function rackBlockHtml(row, variant) {
    const { filled, total } = rackFillStats(row);
    const pct = total ? filled / total : 0;
    let ticks = '';
    for (let i = 0; i < 10; i++) ticks += `<span class="${i / 10 < pct ? 'on' : ''}"></span>`;
    const halfStyle = variant === 'halfheight' || variant === 'fitheight' ? ' style="min-height:0; height:100%;"' : '';
    const halfClass = variant === 'halfheight' ? 'rl-rackblock-corner' : variant === 'fitheight' ? 'rl-rackblock-fit' : '';
    const thinClass = variant === 'thin' ? 'rl-thin' : '';
    return `
      <div class="rl-rackblock ${variant === 'cap' ? 'rl-rackblock-cap' : ''} ${variant === 'small' ? 'rl-rackblock-small' : ''} ${variant === 'short' ? 'rl-rackblock-short' : ''} ${variant === 'tall' ? 'rl-rackblock-tall' : ''} ${halfClass} ${thinClass}"${halfStyle} onclick="RL.goToRack(${row.id})">
        <div class="rl-rackname">${esc(row.name)}</div>
        <div class="rl-rackstat">${variant === 'halfheight' || variant === 'fitheight' ? `${filled}/${total}` : `${filled}/${total} pallets stocked`}</div>
        <div class="rl-rackticks">${ticks}</div>
      </div>`;
  }

  /* ---------------- RACK VISUAL ---------------- */
  function renderRackVisual(row) {
    const layout = RACK_LAYOUT[row.id];
    const positions = layout.maxPos;
    const perCol = row.palletsPerColumn;
    const columnGroups = COLUMN_GROUPS[row.id]
      ? COLUMN_GROUPS[row.id].map(g => g.filter(p => p <= positions)).filter(g => g.length)
      : (function() {
          const out = [];
          for (let start = 1; start <= positions; start += perCol) {
            const g = [];
            for (let p = start; p <= Math.min(start + perCol - 1, positions); p++) g.push(p);
            out.push(g);
          }
          return out;
        })();
    const columns = columnGroups.length;
    const slotHeight = row.id === 16 ? 52 : 64; // Rack #16 is slightly shorter

    let levelsHtml = '';
    layout.levelsOrder.forEach(level => {
      let colsHtml = '<div class="rl-endpost"></div>';
      // Racks 40/42: mirror the whole rack (column order reversed too), so position 1
      // ends up where 10 used to be, 2 where 9 was, etc. Rack 41 only flips within its
      // single column (handled below via colPositions.reverse()).
      const fullyReversed = row.id === 40 || row.id === 42 || row.id === 50 || row.id === 52
        || row.id === 60 || row.id === 61 || row.id === 62 || row.id === 63 || row.id === 15 || row.id === 12 || row.id === 10 || row.id === 30 || row.id === 32;
      const colOrder = [];
      for (let c = 0; c < columns; c++) colOrder.push(c);
      if (fullyReversed) colOrder.reverse();
      colOrder.forEach((c, idx) => {
        if (idx > 0) {
          const prevGroup = columnGroups[colOrder[idx - 1]];
          const prevEnd = prevGroup[prevGroup.length - 1];
          // Rack #17: positions 14-16 are a gap on levels A, B, D — don't show the post
          // that would otherwise sit right after position 14.
          const skipUpright = row.id === 17 && (level === 'A' || level === 'B' || level === 'D') && prevEnd === 14;
          if (!skipUpright) colsHtml += '<div class="rl-upright"></div>';
        }
        const colPositions = columnGroups[c].slice();
        // Rack #41: positions run right-to-left within each column (1 on the right, 2 on
        // the left) instead of the usual left-to-right order. Racks 40/42 also flip
        // within-column order as part of the full-rack mirror.
        if (row.id === 41 || row.id === 51 || fullyReversed) colPositions.reverse();
        for (const p of colPositions) {
          if (isDepthLevel(row.id, level)) {
            const depth = rackDepthOf(row.id);
            const suffixes = depthSuffixes(row.id); // front-to-back, e.g. ['a','b'] or ['a','b','c']
            const anyExists = suffixes.some(s => slotExists(row.id, level, p + s));
            if (!anyExists) {
              colsHtml += '<div class="rl-slot-empty"></div>';
              continue;
            }
            let layersHtml = '';
            // Paint rearmost first so the front layer ends up on top in the DOM/visually.
            for (let k = depth - 1; k >= 0; k--) {
              const suf = suffixes[k];
              const code = level + '-' + p + suf;
              const tag = depthTagFor(row.id, suf);
              const full = row.id + '-' + level + '-' + p + (tag !== 'Front' ? suf : '');
              const items = cellItems(row.id, code);
              const badge = items.length ? `<div class="rl-itembadge">${items.length}/${MAX_ITEMS}</div>` : '';
              const inset = depthLayerInset(k, depth);
              const zIndex = depth - k;
              const noteText = tag === 'Front' ? 'front pallet'
                : tag === 'Middle' ? 'middle pallet, behind front (pull front first)'
                : 'rear pallet, behind everything else (pull the others first)';
              const label = tag === 'Front'
                ? `<div class="rl-slotcode">${p}</div>`
                : `<span class="rl-depthtag">${tag === 'Middle' ? 'M' : 'R'}</span>`;
              layersHtml += `
                <div class="rl-depth-layer ${items.length ? 'filled' : ''}"
                     style="top:${inset.top}; left:${inset.left}; bottom:${inset.bottom}; right:${inset.right}; z-index:${zIndex};"
                     title="${esc(full)}${items.length ? ' — ' + items.length + ' item(s)' : ' — empty'} — ${noteText}"
                     ${items.length ? 'draggable="true"' : ''}
                     ondragstart="RL.dragStart(event, ${row.id}, '${code}')"
                     ondragover="RL.dragOver(event)"
                     ondragenter="RL.dragEnter(event, this)"
                     ondragleave="RL.dragLeave(event, this)"
                     ondrop="RL.dropOn(event, ${row.id}, '${code}')"
                     onclick="RL.openEditor(${row.id}, '${level}', '${p}${suf}')">
                  ${badge}
                  ${label}
                </div>`;
            }
            colsHtml += `<div class="rl-slot-depth">${layersHtml}</div>`;
            continue;
          }
          if (!slotExists(row.id, level, p)) {
            colsHtml += '<div class="rl-slot-empty"></div>';
            continue;
          }
          const code = level + '-' + p;
          const full = row.id + '-' + level + '-' + p;
          const items = cellItems(row.id, code);
          const badge = items.length ? `<div class="rl-itembadge">${items.length}/${MAX_ITEMS}</div>` : '';
          const dragTitle = items.length ? ' — ' + items.length + ' item(s), drag to move' : ' — empty, drop a pallet here';
          colsHtml += `
            <div class="rl-slot ${items.length ? 'filled' : ''}" title="${esc(full)}${dragTitle}"
                 ${items.length ? 'draggable="true"' : ''}
                 ondragstart="RL.dragStart(event, ${row.id}, '${code}')"
                 ondragover="RL.dragOver(event)"
                 ondragenter="RL.dragEnter(event, this)"
                 ondragleave="RL.dragLeave(event, this)"
                 ondrop="RL.dropOn(event, ${row.id}, '${code}')"
                 onclick="RL.openEditor(${row.id}, '${level}', ${p})">
              ${badge}
              <div class="rl-slotcode">${p}</div>
            </div>`;
          // Rack #17 has a physical support post right after position 13 on levels A and B,
          // even though it falls in the middle of a paired column — render it so the post
          // touches pallet 13 on its right side.
          if (row.id === 17 && (level === 'A' || level === 'B' || level === 'D') && p === 13) {
            colsHtml += '<div class="rl-upright"></div>';
          }
        }
      });
      colsHtml += '<div class="rl-endpost"></div>';

      levelsHtml += `
        <div class="rl-level"${level === 'B' && layout.levelsOrder.includes('D') ? ` style="--slot-h:${Math.round(slotHeight / 2)}px;"` : ''}>
          <div class="rl-levelbadge">${row.id}-${level}</div>
          <div class="rl-shelfarea">
            <div class="rl-shelfrow">${colsHtml}</div>
            <div class="rl-beam"></div>
          </div>
        </div>`;
    });

    return `
      <div class="rl-rackscroll">
        <div class="rl-rack" style="--slot-h:${slotHeight}px;">
          ${levelsHtml}
          <div class="rl-floor"></div>
        </div>
      </div>
      <div class="rl-legend">
        <span><span class="rl-legenddot" style="background:#FBFAF7;border:1.5px dashed #C7C2B2;"></span> Empty location</span>
        <span><span class="rl-legenddot" style="background:#F1F7F0;border:1.5px solid #6B9E78;"></span> Has items (badge shows count out of ${MAX_ITEMS})</span>
        <span>Click any position to view, edit, or move its pallet</span>
      </div>`;
  }

  /* ---------------- TABLE ---------------- */
  function allItemRows() {
    const out = [];
    state.rows.forEach(row => {
      const d = state.data[row.id] || {};
      Object.keys(d).forEach(code => {
        const [level, pos] = code.split('-');
        const { clean: cleanFull, tag: depthTag, suffix } = depthInfo(row.id, row.id + '-' + level + '-' + pos);
        (d[code] || []).forEach((item, idx) => {
          out.push({
            rowId: row.id, rowName: row.name, level, pos, code,
            full: cleanFull + (depthTag && depthTag !== 'Front' ? suffix : ''),
            itemIndex: idx, sku: item.sku, description: item.description, quantity: item.quantity != null ? item.quantity : 1
          });
        });
      });
    });
    FLOOR_IDS.forEach(floorId => {
      floorItems(floorId).forEach((item, idx) => {
        out.push({
          isFloor: true, floorId, rowName: 'Floor storage',
          full: CURRENT_WH.floorLabel(floorId),
          itemIndex: idx, sku: item.sku, description: item.description, quantity: item.quantity != null ? item.quantity : 1
        });
      });
    });
    out.sort((a, b) => a.full.localeCompare(b.full, undefined, { numeric: true }));
    return out;
  }

  function renderTable() {
    const q = state.search.trim().toLowerCase();
    const items = allItemRows();
    let rowsHtml = '';
    items.forEach(it => {
      if (q) {
        const hay = (it.full + ' ' + it.rowName + ' ' + it.sku + ' ' + it.description).toLowerCase();
        if (!hay.includes(q)) return;
      }
      const skuHandler = it.isFloor
        ? `RL.quickSaveFloorItem('${it.floorId}', ${it.itemIndex}, this.value, null)`
        : `RL.quickSaveItem(${it.rowId}, '${it.code}', ${it.itemIndex}, this.value, null)`;
      const descHandler = it.isFloor
        ? `RL.quickSaveFloorItem('${it.floorId}', ${it.itemIndex}, null, this.value)`
        : `RL.quickSaveItem(${it.rowId}, '${it.code}', ${it.itemIndex}, null, this.value)`;
      const qtyHandler = it.isFloor
        ? `RL.quickSaveFloorItemQty('${it.floorId}', ${it.itemIndex}, this.value)`
        : `RL.quickSaveItemQty(${it.rowId}, '${it.code}', ${it.itemIndex}, this.value)`;
      const moveHandler = it.isFloor
        ? `RL.moveFloorItemFromTable('${it.floorId}', ${it.itemIndex})`
        : `RL.moveItemFromTable(${it.rowId}, '${it.level}', '${it.pos}', ${it.itemIndex})`;
      rowsHtml += `
        <tr>
          <td class="rl-code">${esc(it.full)}</td>
          <td>${esc(it.rowName)}</td>
          <td><input value="${esc(it.sku)}" placeholder="—" onchange="${skuHandler}"></td>
          <td><input value="${esc(it.description)}" placeholder="—" onchange="${descHandler}"></td>
          <td><input type="number" min="0" style="width:100%; text-align:center;" value="${it.quantity}" onchange="${qtyHandler}"></td>
          <td style="text-align:center;"><button class="rl-itemmoveicon" onclick="${moveHandler}" title="Move this product to another location" aria-label="Move this product to another location">⇄</button></td>
        </tr>`;
    });
    if (!rowsHtml) rowsHtml = `<tr><td colspan="6" class="rl-emptytag">No items match your search</td></tr>`;

    return `
      <div class="rl-tablebar">
        <input id="rl-rack-search" class="rl-search rl-keepfocus" placeholder="Search location, SKU, or description…" value="${esc(state.search)}"
               oninput="RL.setSearch(this.value)">
        <div class="rl-tablesummary">${items.length} item(s) stocked across ${state.rows.length} racks in ${esc(CURRENT_WH.name)}</div>
        <div class="rl-configspacer"></div>
        <button class="rl-btn" onclick="RL.exportCsv()">Export CSV</button>
        <button class="rl-btn rl-danger" onclick="RL.resetAll()">Reset all data</button>
      </div>
      <div class="rl-table-scroll">
      <table class="rl-table">
        <colgroup>
          <col style="width:100px;">
          <col style="width:90px;">
          <col style="width:90px;">
          <col>
          <col style="width:84px;">
          <col style="width:60px;">
        </colgroup>
        <thead><tr><th>Location</th><th>Rack</th><th>SKU</th><th>Description</th><th>Qty</th><th></th></tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
      </div>`;
  }

  /* ---------------- MODAL ---------------- */
  function renderModal() {
    if (!state.editing) return '';
    const e = state.editing;
    const row = getRow(e.rowId);
    const { clean: cleanFull, tag: depthTag, suffix } = depthInfo(e.rowId, e.rowId + '-' + e.level + '-' + e.pos);
    const full = cleanFull + (depthTag && depthTag !== 'Front' ? suffix : '');
    const cleanPos = depthInfo(e.rowId, e.pos).clean + (depthTag && depthTag !== 'Front' ? suffix : '');

    let itemsHtml = '';
    e.items.forEach((item, i) => {
      const showItemMove = e.itemMoveIndex === i;
      let itemMoveHtml = '';
      if (showItemMove) {
        const t = e.itemMoveTarget;
        const whOptionsI = Object.values(WAREHOUSES).map(w => `<option value="${w.id}" ${w.id === t.whId ? 'selected' : ''}>${esc(w.name)}</option>`).join('');
        const targetCacheI = whCache[t.whId] || { rows: [] };
        const rowOptionsI = targetCacheI.rows.map(r => `<option value="${r.id}" ${r.id === t.rowId ? 'selected' : ''}>${esc(r.name)}</option>`).join('');
        const targetLayoutI = WAREHOUSES[t.whId].layout;
        const levelsI = (targetLayoutI[t.rowId] && targetLayoutI[t.rowId].levelsOrder) || [];
        const levelOptionsI = levelsI.map(l => `<option value="${l}" ${l === t.level ? 'selected' : ''}>${l}</option>`).join('');
        itemMoveHtml = `
          <div class="rl-movegrid">
            <div class="rl-movefield">
              <label>Warehouse</label>
              <select onchange="RL.setItemMoveField('whId', this.value)">${whOptionsI}</select>
            </div>
            <div class="rl-movefield">
              <label>Rack</label>
              <select onchange="RL.setItemMoveField('rowId', parseInt(this.value))">${rowOptionsI}</select>
            </div>
            <div class="rl-movefield">
              <label>Level</label>
              <select onchange="RL.setItemMoveField('level', this.value)">${levelOptionsI}</select>
            </div>
            <div class="rl-movefield">
              <label>Position</label>
              <input type="text" value="${esc(String(t.pos))}" placeholder="e.g. 1 or 1a" onchange="RL.setItemMoveField('pos', this.value.trim())">
            </div>
          </div>
          <button class="rl-btn rl-primary" style="width:100%; margin-top:10px;" onclick="RL.confirmItemMove()">Move this item here</button>
        `;
      }
      itemsHtml += `
        <tr>
          <td style="border:1px solid #1E1E1C; border-top:none; padding:6px 8px; vertical-align:middle;">
            <input value="${esc(item.description)}" placeholder="Search the catalog…" autocomplete="off"
                   class="rl-cat-input" data-editor="rack" data-index="${i}"
                   onchange="RL.pickItemField(${i}, 'description', this.value)"
                   style="width:100%; border:none; background:transparent; font-family:'Inter',sans-serif; font-size:13px; color:#1E1E1C; padding:0; outline:none;">
            <input value="${esc(item.sku)}" placeholder="Item code" autocomplete="off"
                   class="rl-cat-input" data-editor="rack" data-index="${i}"
                   onchange="RL.pickItemField(${i}, 'sku', this.value)"
                   style="width:100%; border:none; background:transparent; font-family:'JetBrains Mono',monospace; font-size:11px; color:#8A877C; padding:2px 0 0; outline:none;">
            ${item.sku && !catalogByCode(item.sku) ? `<div style="font-family:'Inter',sans-serif; font-size:10px; font-weight:600; color:#B07A12; margin-top:2px;">Not in the item catalog</div>` : ''}
          </td>
          <td style="border:1px solid #1E1E1C; border-top:none; border-left:none; padding:2px 8px; width:110px; text-align:center; vertical-align:middle;">
            <input type="number" min="0" value="${item.quantity != null ? item.quantity : 1}" onchange="RL.updateItemField(${i}, 'quantity', parseInt(this.value)||0)"
                   style="width:100%; border:none; background:transparent; font-family:'Inter',sans-serif; font-size:28px; font-weight:500; color:#1E1E1C; text-align:center; padding:0; outline:none;">
          </td>
          <td style="border:none; padding:0 0 0 6px; width:22px; vertical-align:middle;">
            <button onclick="RL.toggleItemMove(${i})" aria-label="Move this item to another pallet" title="Move this item to another pallet"
                    style="border:none; background:transparent; color:${showItemMove ? '#C0392B' : '#A6A398'}; font-size:15px; cursor:pointer; padding:2px;">⇄</button>
          </td>
        </tr>
        ${showItemMove ? `<tr><td colspan="3" style="border:none; padding:10px 0 4px;">${itemMoveHtml}</td></tr>` : ''}`;
    });
    const addBtn = e.items.length < MAX_ITEMS && e.items.length > 0
      ? `<button class="rl-addbtn" onclick="RL.addItem()">+ Add item (up to ${MAX_ITEMS} per pallet)</button>` : '';

    const whOptions = Object.values(WAREHOUSES).map(w => `<option value="${w.id}" ${w.id === e.moveTarget.whId ? 'selected' : ''}>${esc(w.name)}</option>`).join('');
    const targetCache = whCache[e.moveTarget.whId] || { rows: [] };
    const rowOptions = targetCache.rows.map(r => `<option value="${r.id}" ${r.id === e.moveTarget.rowId ? 'selected' : ''}>${esc(r.name)}</option>`).join('');
    const targetLayout = WAREHOUSES[e.moveTarget.whId].layout;
    const targetLevels = (targetLayout[e.moveTarget.rowId] && targetLayout[e.moveTarget.rowId].levelsOrder) || [];
    const levelOptions = targetLevels.map(l => `<option value="${l}" ${l === e.moveTarget.level ? 'selected' : ''}>${l}</option>`).join('');

    const moveSection = e.showMove ? `
      <div class="rl-movegrid">
        <div class="rl-movefield">
          <label>Warehouse</label>
          <select onchange="RL.setMoveField('whId', this.value)">${whOptions}</select>
        </div>
        <div class="rl-movefield">
          <label>Rack</label>
          <select onchange="RL.setMoveField('rowId', parseInt(this.value))">${rowOptions}</select>
        </div>
        <div class="rl-movefield">
          <label>Level</label>
          <select onchange="RL.setMoveField('level', this.value)">${levelOptions}</select>
        </div>
        <div class="rl-movefield">
          <label>Position</label>
          <input type="text" value="${esc(String(e.moveTarget.pos))}" placeholder="e.g. 1 or 1a" onchange="RL.setMoveField('pos', this.value.trim())">
        </div>
      </div>
      <button class="rl-btn rl-primary" style="width:100%; margin-top:14px; padding:12px; font-size:14px;" onclick="RL.confirmMove()">Move / swap pallet here</button>
    ` : '';

    return `
      <div class="rl-overlay" onclick="if(event.target===this) return;">
        <div class="rl-modal">
          <div class="rl-eyebrow">Pallet #</div>
          <h3 style="font-size:30px; margin-bottom:14px;">${esc(full)}</h3>

          <table style="width:100%; border-collapse:collapse; table-layout:fixed;">
            <thead>
              <tr>
                <th style="border:1px solid #1E1E1C; padding:5px 8px; text-align:left; font-family:'Inter',sans-serif; font-size:11px; font-weight:600; color:#1E1E1C;">Description</th>
                <th style="border:1px solid #1E1E1C; border-left:none; padding:5px 8px; width:110px; text-align:left; font-family:'Inter',sans-serif; font-size:11px; font-weight:600; color:#1E1E1C;">Quantity</th>
                <th style="border:none; width:22px;"></th>
              </tr>
            </thead>
            <tbody>${itemsHtml}</tbody>
          </table>
          ${itemsHtml ? '' : `<button class="rl-addbtn" style="margin-top:12px;" onclick="RL.addItem()">+ Add product</button>`}
          ${addBtn}

          <div class="rl-movesection">
            <button class="rl-movetoggle" onclick="RL.toggleMove()">${e.showMove ? '▾' : '▸'} Move Full Pallet</button>
            ${moveSection}
          </div>

          <div class="rl-modalbtns">
            <button class="rl-btn" onclick="RL.closeEditor()">Cancel</button>
            <button class="rl-btn rl-primary" onclick="RL.submitEditor()">Save</button>
          </div>
        </div>
      </div>`;
  }

  function renderFloorModal() {
    if (!state.floorEditing) return '';
    const e = state.floorEditing;

    let itemsHtml = '';
    e.items.forEach((item, i) => {
      const showItemMove = e.itemMoveIndex === i;
      let itemMoveHtml = '';
      if (showItemMove) {
        const t = e.itemMoveTarget;
        const whOptionsI = Object.values(WAREHOUSES).map(w => `<option value="${w.id}" ${w.id === t.whId ? 'selected' : ''}>${esc(w.name)}</option>`).join('');
        const targetCacheI = whCache[t.whId] || { rows: [] };
        const rowOptionsI = targetCacheI.rows.map(r => `<option value="${r.id}" ${r.id === t.rowId ? 'selected' : ''}>${esc(r.name)}</option>`).join('');
        const targetLayoutI = WAREHOUSES[t.whId].layout;
        const levelsI = (targetLayoutI[t.rowId] && targetLayoutI[t.rowId].levelsOrder) || [];
        const levelOptionsI = levelsI.map(l => `<option value="${l}" ${l === t.level ? 'selected' : ''}>${l}</option>`).join('');
        itemMoveHtml = `
          <div class="rl-movegrid">
            <div class="rl-movefield">
              <label>Warehouse</label>
              <select onchange="RL.setFloorItemMoveField('whId', this.value)">${whOptionsI}</select>
            </div>
            <div class="rl-movefield">
              <label>Rack</label>
              <select onchange="RL.setFloorItemMoveField('rowId', parseInt(this.value))">${rowOptionsI}</select>
            </div>
            <div class="rl-movefield">
              <label>Level</label>
              <select onchange="RL.setFloorItemMoveField('level', this.value)">${levelOptionsI}</select>
            </div>
            <div class="rl-movefield">
              <label>Position</label>
              <input type="text" value="${esc(String(t.pos))}" placeholder="e.g. 1 or 1a" onchange="RL.setFloorItemMoveField('pos', this.value.trim())">
            </div>
          </div>
          <button class="rl-btn rl-primary" style="width:100%; margin-top:10px;" onclick="RL.confirmFloorItemMove()">Move onto that rack location</button>
        `;
      }
      itemsHtml += `
        <div class="rl-itemcard">
          <button class="rl-itemremove" onclick="RL.removeFloorItem(${i})" aria-label="Remove item">✕</button>
          <div class="rl-itemnum">
            Pallet ${i + 1} of ${e.items.length}
            <button class="rl-itemmoveicon ${showItemMove ? 'active' : ''}" onclick="RL.toggleFloorItemMove(${i})" title="Move this item onto a rack location" aria-label="Move this item onto a rack location">⇄</button>
          </div>
          <div class="rl-fieldrow">
            <div class="rl-field">
              <input value="${esc(item.sku)}" placeholder="Item code" autocomplete="off" class="rl-cat-input" data-editor="floor" data-index="${i}" onchange="RL.pickFloorItemField(${i}, 'sku', this.value)">
            </div>
            <div class="rl-field rl-qtyfield">
              <label>Qty</label>
              <input type="number" min="0" value="${item.quantity != null ? item.quantity : 1}" placeholder="Qty" title="How many of this product" onchange="RL.updateFloorItemField(${i}, 'quantity', parseInt(this.value)||0)">
            </div>
          </div>
          <div class="rl-field">
            <textarea rows="${item.description && item.description.length > 42 ? 2 : 1}" placeholder="Description" class="rl-cat-input" data-editor="floor" data-index="${i}" oninput="this.style.height='auto'; this.style.height=this.scrollHeight+'px';" onchange="RL.updateFloorItemField(${i}, 'description', this.value)">${esc(item.description)}</textarea>
          </div>
          ${itemMoveHtml}
        </div>`;
    });

    return `
      <div class="rl-overlay" onclick="if(event.target===this) RL.closeFloorEditor()">
        <div class="rl-modal">
          <div class="rl-eyebrow">Floor storage</div>
          <h3>${esc(CURRENT_WH.floorLabel(e.floorId))}</h3>
          <div class="rl-code" style="color:#A6A398;">Pallets sitting on the floor in this aisle — no specific rack location</div>

          ${itemsHtml || '<div class="rl-emptytag" style="display:block;margin-top:14px;">No pallets logged on this floor yet.</div>'}
          <button class="rl-addbtn" onclick="RL.addFloorItem()">+ Add pallet</button>

          <div class="rl-modalbtns">
            <button class="rl-btn" onclick="RL.closeFloorEditor()">Cancel</button>
            <button class="rl-btn rl-primary" onclick="RL.submitFloorEditor()">Save</button>
          </div>
        </div>
      </div>`;
  }

  /* ---------------- GLOBAL ITEM INDEX (all warehouses) ---------------- */
  function allItemRowsGlobal() {
    const out = [];
    Object.values(WAREHOUSES).forEach(wh => {
      const cache = whCache[wh.id];
      if (!cache) return;
      cache.rows.forEach(row => {
        const d = cache.data[row.id] || {};
        Object.keys(d).forEach(code => {
          const parts = code.split('-');
          const level = parts[0], pos = parts[1];
          const di = depthInfo(row.id, row.id + '-' + level + '-' + pos);
          (d[code] || []).forEach((item, idx) => out.push({
            whId: wh.id, whName: wh.name, rowId: row.id, rowName: row.name, level, pos, code,
            full: di.clean + (di.tag && di.tag !== 'Front' ? di.suffix : ''), depthTag: di.tag,
            itemIndex: idx, sku: item.sku || '', description: item.description || '',
            quantity: item.quantity != null ? item.quantity : 1
          }));
        });
      });
      wh.floorIds.forEach(fid => {
        ((cache.floorData || {})[fid] || []).forEach((item, idx) => out.push({
          whId: wh.id, whName: wh.name, isFloor: true, floorId: fid, rowName: 'Floor storage',
          full: wh.floorLabel(fid), itemIndex: idx, sku: item.sku || '', description: item.description || '',
          quantity: item.quantity != null ? item.quantity : 1
        }));
      });
    });
    return out;
  }

  // Rolls the flat placement list up into one entry per distinct item.
  function itemIndexGlobal() {
    const groups = {};
    allItemRowsGlobal().forEach(p => {
      const cat = catalogByCode(p.sku) || catalogByDesc(p.description);
      const key = cat ? cat.c.toUpperCase() : itemKeyOf(p);
      if (!groups[key]) groups[key] = {
        key, sku: cat ? cat.c : p.sku, description: cat ? cat.d : p.description,
        section: cat ? cat.s : '', inCatalog: !!cat, places: [], totalQty: 0
      };
      groups[key].places.push(p);
      groups[key].totalQty += p.quantity;
    });
    return groups;
  }

  function globalNav(active) {
    const tab = (id, label, onclick) => `
      <button onclick="${onclick}" style="flex:1 1 0; min-width:0; min-height:46px; padding:9px 6px; border:1px solid ${active === id ? '#B33A2E' : '#DAD6C9'};
              background:${active === id ? '#B33A2E' : '#FFF'}; color:${active === id ? '#FFF7F1' : '#55534C'};
              border-radius:8px; font-family:'Inter',sans-serif; font-size:13px; font-weight:600; cursor:pointer; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${label}</button>`;
    return `<div style="display:flex; gap:6px; max-width:1180px; margin:0 auto 18px;">
      ${tab('map', 'Warehouses', 'RL.showMap()')}
      ${tab('find', 'Find item', 'RL.goFind()')}
      ${tab('catalog', 'Catalog', 'RL.goCatalog()')}
      ${tab('audit', 'Activity', 'RL.goAudit()')}
    </div>`;
  }

  // Sticky banner shown while an item picked from the catalog is waiting to be placed.
  function placingBanner() {
    const p = state.placing;
    if (!p) return '';
    return `<div style="position:sticky; top:0; z-index:30; display:flex; align-items:center; gap:10px; flex-wrap:wrap;
                 background:#FFF3B0; border:1.5px solid #E3B400; border-radius:10px; padding:10px 12px; margin:0 auto 16px; max-width:1180px;">
      <div style="flex:1 1 200px; min-width:0;">
        <div style="font-family:'JetBrains Mono',monospace; font-size:10px; font-weight:700; letter-spacing:1px; text-transform:uppercase; color:#8A6A00;">Placing item — tap a pallet slot</div>
        <div style="font-family:'Inter',sans-serif; font-size:13.5px; font-weight:600; color:#3B3A35; margin-top:2px;">${esc(p.description || p.sku)}</div>
      </div>
      <button class="rl-btn" style="min-height:40px;" onclick="RL.cancelPlacing()">Cancel</button>
    </div>`;
  }

  /* ---------------- FIND ITEM ---------------- */
  function renderFind() {
    const q = state.findQuery.trim().toLowerCase();
    const groups = itemIndexGlobal();
    const located = Object.values(groups);
    // Default view lists every located item so the whole shared inventory —
    // everything any user has placed — is visible to everyone at a glance;
    // typing filters that same list (and surfaces catalog items not yet placed).
    const totalPlaced = located.reduce((n, g) => n + g.places.length, 0);

    const cardFor = (g) => {
      const places = g.places.slice().sort((a, b) => a.full.localeCompare(b.full, undefined, { numeric: true }));
      const rows = places.map(p => {
        const go = p.isFloor
          ? `RL.goToFloor('${p.whId}', '${p.floorId}')`
          : `RL.goToLocation('${p.whId}', ${p.rowId}, '${p.level}', '${p.pos}')`;
        return `<button onclick="${go}" style="display:flex; align-items:center; gap:10px; width:100%; min-height:52px; text-align:left;
                  background:#FBFAF7; border:1px solid #E4E1D8; border-radius:8px; padding:8px 10px; cursor:pointer;">
          <span style="flex:1 1 auto; min-width:0;">
            <span style="display:block; font-family:'JetBrains Mono',monospace; font-size:15px; font-weight:800; color:#0D0D0C;">${esc(p.full)}</span>
            <span style="display:block; font-size:11.5px; color:#8A877C; margin-top:1px;">${esc(p.whName)}${p.isFloor ? '' : ' · ' + esc(p.rowName)}${p.depthTag && p.depthTag !== 'Front' ? ' · ' + esc(p.depthTag) : ''}</span>
          </span>
          <span style="flex:0 0 auto; font-family:'JetBrains Mono',monospace; font-size:12px; font-weight:700; color:#3F7D4E; background:#EDF5EE; border-radius:6px; padding:4px 8px;">×${p.quantity}</span>
          <span style="flex:0 0 auto; color:#B7B3A5; font-size:16px;">›</span>
        </button>`;
      }).join('');
      return `<div class="rl-warehouse" style="padding:16px; margin-bottom:12px;">
        <div style="font-family:'Inter',sans-serif; font-size:14.5px; font-weight:600; color:#1E1E1C; line-height:1.35;">${esc(g.description)}</div>
        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-top:5px;">
          <span class="rl-code">${esc(g.sku)}</span>
          ${g.section ? `<span style="font-family:'JetBrains Mono',monospace; font-size:10px; font-weight:700; color:#8A877C; background:#F3F1EC; border-radius:5px; padding:2px 6px;">${esc(g.section)}</span>` : ''}
          <span style="font-size:11.5px; color:#8A877C;">${g.places.length} location${g.places.length === 1 ? '' : 's'} · ${g.totalQty} total</span>
        </div>
        <div style="display:flex; flex-direction:column; gap:6px; margin-top:12px;">${rows}</div>
        <button class="rl-btn" style="width:100%; min-height:44px; margin-top:8px;" onclick="RL.startPlacing('${esc(g.sku)}', '${esc(g.description).replace(/'/g, '&#39;')}')">+ Place another pallet</button>
      </div>`;
    };

    let listGroups, unlocated = [], emptyMsg;
    if (!q) {
      listGroups = located.slice().sort((a, b) => a.description.localeCompare(b.description));
      emptyMsg = 'Nothing has been placed in the warehouse yet. Open “Catalog” to give an item its first location.';
    } else {
      listGroups = located.filter(g => (g.sku + ' ' + g.description).toLowerCase().includes(q))
                          .sort((a, b) => a.description.localeCompare(b.description));
      const locatedKeys = {};
      listGroups.forEach(g => locatedKeys[g.key] = 1);
      unlocated = CATALOG.filter(it => !locatedKeys[it.c.toUpperCase()] &&
        (it.c + ' ' + it.d).toLowerCase().includes(q)).slice(0, 40);
      emptyMsg = `Nothing matches “${esc(state.findQuery)}”.`;
    }

    const cards = listGroups.map(cardFor).join('');
    const unCards = unlocated.map(it => `<div class="rl-warehouse" style="padding:14px 16px; margin-bottom:10px; background:#FCFBF8;">
        <div style="font-family:'Inter',sans-serif; font-size:14px; font-weight:600; color:#1E1E1C; line-height:1.35;">${esc(it.d)}</div>
        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-top:5px;">
          <span class="rl-code">${esc(it.c)}</span>
          <span style="font-family:'JetBrains Mono',monospace; font-size:10px; font-weight:700; color:#8A877C; background:#F3F1EC; border-radius:5px; padding:2px 6px;">${esc(it.s)}</span>
          <span style="font-size:11.5px; color:#B7B3A5; font-style:italic;">No location saved</span>
        </div>
        <button class="rl-btn" style="width:100%; min-height:44px; margin-top:10px;" onclick="RL.startPlacing('${esc(it.c)}', '${esc(it.d).replace(/'/g, '&#39;')}')">Give it a location</button>
      </div>`).join('');

    const summary = `<div style="font-family:'JetBrains Mono',monospace; font-size:11px; font-weight:600; letter-spacing:0.4px; color:#8A877C; margin-bottom:12px;">${q ? listGroups.length + ' match' + (listGroups.length === 1 ? '' : 'es') : located.length + ' item' + (located.length === 1 ? '' : 's') + ' placed'} · ${totalPlaced} pallet placement${totalPlaced === 1 ? '' : 's'} · one shared inventory, all users</div>`;

    const listBody = (cards || unCards)
      ? cards + (unCards ? `<div style="font-family:'JetBrains Mono',monospace; font-size:10.5px; font-weight:700; letter-spacing:1.2px; text-transform:uppercase; color:#A6A398; margin:18px 0 10px;">In the catalog, not yet located</div>` + unCards : '')
      : `<div style="text-align:center; padding:34px 16px; color:#A6A398; font-size:13.5px;">${emptyMsg}</div>`;

    // Spreadsheet view — one row per placed item + its location, across every
    // warehouse, like the rack spreadsheet. Tap a row to jump to that pallet.
    let placements = allItemRowsGlobal().map(p => {
      const cat = catalogByCode(p.sku) || catalogByDesc(p.description);
      return { ...p, code: cat ? cat.c : p.sku, desc: cat ? cat.d : p.description };
    });
    if (q) placements = placements.filter(p =>
      (p.code + ' ' + p.desc + ' ' + p.full + ' ' + p.whName + ' ' + (p.rowName || '')).toLowerCase().includes(q));
    placements.sort((a, b) =>
      (a.desc || '').localeCompare(b.desc || '') || a.full.localeCompare(b.full, undefined, { numeric: true }));
    let tableRows = placements.map(p => {
      const go = p.isFloor ? `RL.goToFloor('${p.whId}', '${p.floorId}')`
                           : `RL.goToLocation('${p.whId}', ${p.rowId}, '${p.level}', '${p.pos}')`;
      return `<tr onclick="${go}" style="cursor:pointer;">
        <td class="rl-code">${esc(p.code)}</td>
        <td>${esc(p.desc)}</td>
        <td style="font-family:'JetBrains Mono',monospace; font-weight:800; color:#0D0D0C;">${esc(p.full)}</td>
        <td>${esc(p.whName)}${p.isFloor ? '' : ' · ' + esc(p.rowName)}</td>
        <td style="text-align:center;">${p.quantity}</td>
      </tr>`;
    }).join('');
    if (!tableRows) tableRows = `<tr><td colspan="5" class="rl-emptytag">${q ? 'No items match your search' : 'Nothing placed yet'}</td></tr>`;
    const tableBody = `<div class="rl-table-scroll"><table class="rl-table" style="min-width:600px;">
      <colgroup><col style="width:120px;"><col><col style="width:96px;"><col style="width:150px;"><col style="width:54px;"></colgroup>
      <thead><tr><th>Item code</th><th>Description</th><th>Location</th><th>Warehouse</th><th>Qty</th></tr></thead>
      <tbody>${tableRows}</tbody></table></div>`;

    const isTable = state.findView === 'table';
    const toggle = `<div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom:14px;">
      <div class="rl-viewtoggle" style="width:max-content;">
        <button class="${isTable ? '' : 'active'}" onclick="RL.setFindView('list')">List</button>
        <button class="${isTable ? 'active' : ''}" onclick="RL.setFindView('table')">Spreadsheet</button>
      </div>
      ${isTable ? `<button class="rl-btn" onclick="RL.exportFindCsv()">Export CSV</button>` : ''}
    </div>`;

    return `
      <input id="rl-find-search" class="rl-keepfocus" type="search" value="${esc(state.findQuery)}" oninput="RL.setFindQuery(this.value)" autocomplete="off"
             placeholder="Search all items…"
             style="width:100%; min-height:52px; padding:12px 14px; border:1.5px solid #DAD6C9; border-radius:10px;
                    font-family:'Inter',sans-serif; font-size:16px; background:#FFF; color:#1E1E1C; margin-bottom:14px;">
      ${toggle}
      ${summary}
      ${isTable ? tableBody : listBody}`;
  }

  /* ---------------- ITEM CATALOG ---------------- */
  function renderCatalog() {
    const q = state.catalogQuery.trim().toLowerCase();
    const groups = itemIndexGlobal();
    const byCode = {};
    Object.values(groups).forEach(g => { if (g.sku) byCode[g.sku.toUpperCase()] = g; });

    let list = CATALOG.filter(it => !q || (it.c + ' ' + it.d).toLowerCase().includes(q));
    if (state.catalogFilter === 'located') list = list.filter(it => byCode[it.c.toUpperCase()]);
    if (state.catalogFilter === 'unlocated') list = list.filter(it => !byCode[it.c.toUpperCase()]);

    const locatedCount = CATALOG.filter(it => byCode[it.c.toUpperCase()]).length;
    const shown = list.slice(0, 300);

    const chip = (id, label) => `<button onclick="RL.setCatalogFilter('${id}')" style="min-height:40px; padding:8px 12px; border-radius:8px; cursor:pointer;
        border:1px solid ${state.catalogFilter === id ? '#B33A2E' : '#DAD6C9'}; background:${state.catalogFilter === id ? '#FBEAE7' : '#FFF'};
        color:${state.catalogFilter === id ? '#B33A2E' : '#55534C'}; font-family:'Inter',sans-serif; font-size:12.5px; font-weight:600;">${label}</button>`;

    const rows = shown.map(it => {
      const g = byCode[it.c.toUpperCase()];
      return `<button onclick="${g ? `RL.findItem('${esc(it.c)}')` : `RL.startPlacing('${esc(it.c)}', '${esc(it.d).replace(/'/g, '&#39;')}')`}"
              style="display:flex; align-items:center; gap:10px; width:100%; text-align:left; min-height:56px; background:#FFF;
                     border:none; border-bottom:1px solid #EFEDE5; padding:10px 12px; cursor:pointer;">
        <span style="flex:1 1 auto; min-width:0;">
          <span style="display:block; font-family:'Inter',sans-serif; font-size:13.5px; font-weight:500; color:#1E1E1C; line-height:1.3;">${esc(it.d)}</span>
          <span style="display:block; font-family:'JetBrains Mono',monospace; font-size:11px; font-weight:600; color:#8E2A20; margin-top:2px;">${esc(it.c)} · ${esc(it.s)}</span>
        </span>
        ${g
          ? `<span style="flex:0 0 auto; text-align:right;">
               <span style="display:block; font-family:'JetBrains Mono',monospace; font-size:13px; font-weight:800; color:#0D0D0C;">${esc(g.places[0].full)}${g.places.length > 1 ? ' +' + (g.places.length - 1) : ''}</span>
               <span style="display:block; font-size:10.5px; color:#3F7D4E; font-weight:600; margin-top:1px;">${g.totalQty} on hand</span>
             </span>`
          : `<span style="flex:0 0 auto; font-family:'Inter',sans-serif; font-size:11.5px; font-weight:600; color:#B7B3A5;">Locate →</span>`}
      </button>`;
    }).join('');

    return `
      <input id="rl-catalog-search" class="rl-keepfocus" type="search" value="${esc(state.catalogQuery)}" oninput="RL.setCatalogQuery(this.value)" autocomplete="off"
             placeholder="Search ${CATALOG.length} items…"
             style="width:100%; min-height:52px; padding:12px 14px; border:1.5px solid #DAD6C9; border-radius:10px;
                    font-family:'Inter',sans-serif; font-size:16px; background:#FFF; color:#1E1E1C; margin-bottom:12px;">
      <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:12px;">
        ${chip('all', 'All ' + CATALOG.length)}
        ${chip('located', 'Located ' + locatedCount)}
        ${chip('unlocated', 'No location ' + (CATALOG.length - locatedCount))}
      </div>
      <div class="rl-warehouse" style="padding:0; overflow:hidden;">
        ${rows || '<div style="padding:30px; text-align:center; color:#A6A398; font-size:13.5px;">No items match.</div>'}
      </div>
      ${list.length > shown.length ? `<div style="text-align:center; padding:12px; color:#A6A398; font-size:12px;">Showing first ${shown.length} of ${list.length} — narrow your search.</div>` : ''}`;
  }

  /* ---------------- ACTIVITY / AUDIT ---------------- */
  function renderAudit() {
    if (!auditLog.length) {
      return `<div class="rl-warehouse" style="text-align:center; padding:38px 20px; color:#8A877C;">
        <div style="font-family:'Barlow Condensed',sans-serif; font-size:22px; font-weight:700; text-transform:uppercase; color:#55534C;">No activity yet</div>
        <div style="font-size:13.5px; margin-top:6px;">Every pallet added, moved, or cleared will be logged here.</div>
      </div>`;
    }
    const rows = auditLog.slice(0, 200).map(e => `
      <div style="display:flex; gap:10px; align-items:flex-start; padding:11px 12px; border-bottom:1px solid #EFEDE5;">
        <span style="flex:0 0 auto; margin-top:2px; font-family:'JetBrains Mono',monospace; font-size:9.5px; font-weight:800; letter-spacing:0.5px;
                     text-transform:uppercase; color:#FFF; background:${auditActionColor(e.a)}; border-radius:5px; padding:3px 6px;">${esc(auditActionLabel(e.a))}</span>
        <span style="flex:1 1 auto; min-width:0;">
          <span style="display:block; font-family:'Inter',sans-serif; font-size:13px; font-weight:500; color:#1E1E1C; line-height:1.35;">${esc(e.desc || e.sku || '(pallet)')}</span>
          <span style="display:block; font-family:'JetBrains Mono',monospace; font-size:11px; color:#8A877C; margin-top:2px;">
            ${e.from ? esc(e.from) + ' → ' + esc(e.to || '') : esc(e.loc || '')}${e.wh ? ' · ' + esc(e.wh) : ''}${e.qty != null ? ' · ×' + e.qty : ''}${e.prevQty != null ? ' (was ×' + e.prevQty + ')' : ''}
          </span>
        </span>
        <span style="flex:0 0 auto; text-align:right;">
          <span style="display:block; font-size:11px; color:#A6A398;">${esc(timeAgo(e.t))}</span>
          <span style="display:block; font-size:10.5px; font-weight:600; color:#8A877C; margin-top:1px;">${esc(e.u || '')}</span>
        </span>
      </div>`).join('');
    return `<div class="rl-warehouse" style="padding:0; overflow:hidden;">${rows}</div>`;
  }

  /* ---------------- MAIN RENDER ---------------- */
  // render() rebuilds the whole screen, which drops focus from a search box the
  // user is typing in (so only one letter registers). This wraps render() and
  // restores focus + caret to the same search input afterwards.
  function renderKeepingFocus() {
    const active = document.activeElement;
    const keep = active && active.classList && active.classList.contains('rl-keepfocus');
    const id = keep ? active.id : null;
    const caret = keep && active.selectionStart != null ? active.selectionStart : null;
    render();
    if (id) {
      const el = root.querySelector('#' + id);
      if (el) {
        el.focus();
        const pos = caret != null ? caret : el.value.length;
        try { el.setSelectionRange(pos, pos); } catch (e) {}
      }
    }
  }

  function render() {
    if (!state.ready) return;

    if (state.screen === 'find' || state.screen === 'catalog' || state.screen === 'audit') {
      const titles = { find: 'Find an item', catalog: 'Item catalog', audit: 'Activity log' };
      root.innerHTML = `
        ${placingBanner()}
        <div class="rl-top">
          <div>
            <div class="rl-eyebrow">Damen warehouse inventory</div>
            <h1>${titles[state.screen]}</h1>
          </div>
        </div>
        ${globalNav(state.screen)}
        <div class="rl-wrap">${state.screen === 'find' ? renderFind() : state.screen === 'catalog' ? renderCatalog() : renderAudit()}</div>
        ${state.flash ? `<div class="rl-flash">${esc(state.flash)}</div>` : ''}
      `;
      return;
    }

    if (state.screen === 'dashboard') {
      root.innerHTML = `
        <div class="rl-top">
          <div>
            <div class="rl-eyebrow">Damen preorder system</div>
            <h1>Warehouses</h1>
          </div>
          <button class="rl-backbtn" onclick="RL.showMap()">← Back to warehouse view</button>
        </div>
        ${globalNav('')}
        <div class="rl-wrap">${renderDashboard()}</div>
        ${state.flash ? `<div class="rl-flash">${esc(state.flash)}</div>` : ''}
      `;
      return;
    }

    if (state.screen === 'map') {
      root.innerHTML = `
        ${placingBanner()}
        <div class="rl-top">
          <div>
            <div class="rl-eyebrow">Damen preorder system</div>
            <h1>Warehouse view</h1>
          </div>
          <button class="rl-backbtn" onclick="RL.goDashboard()">Warehouse list →</button>
        </div>
        ${globalNav('map')}
        <div class="rl-wrap">${renderWarehouseMap()}</div>
        ${state.flash ? `<div class="rl-flash">${esc(state.flash)}</div>` : ''}
      `;
      return;
    }

    let navExtra = '';
    if (state.screen === 'rack') {
      navExtra += `<button class="rl-backbtn" onclick="RL.goOverview()">← Back to ${esc(CURRENT_WH.name)}</button>`;
    }
    navExtra += `<button class="rl-backbtn" onclick="RL.showMap()">← Back to warehouse view</button>`;
    let pageTitle = 'Rack locator';

    let body = '';
    if (state.screen === 'overview') {
      body = CURRENT_WH.id === 'freezer' ? renderOverviewFreezer()
        : CURRENT_WH.id === 'fridge40' ? renderOverviewFridge40()
        : CURRENT_WH.id === 'fridge50' ? renderOverviewFridge50()
        : CURRENT_WH.id === 'fridge60' ? renderOverviewFridge60()
        : renderOverviewDry();
    } else if (state.screen === 'rack') {
      const activeRow = getRow(state.activeRowId) || state.rows[0];
      pageTitle = activeRow.name;
      const activeLayout = RACK_LAYOUT[activeRow.id];
      const tabsHtml = state.rows.map(r => `
        <button class="rl-rowtab ${r.id === activeRow.id ? 'active' : ''}" onclick="RL.setActiveRow(${r.id})">${esc(r.name)}</button>
      `).join('');
      const configHtml = `
        <div class="rl-config">
          <span class="rl-configlabel">Columns</span>
          <span class="rl-configvalue">1–${activeLayout.maxPos}</span>
          <span class="rl-configlabel">Levels</span>
          <span class="rl-configvalue">${activeLayout.levelsOrder.slice().reverse().join(', ')}</span>
          <span class="rl-configlabel">Pallets per column</span>
          <label><input type="number" min="1" max="4" value="${activeRow.palletsPerColumn}"
                 onchange="RL.updateField(${activeRow.id}, 'palletsPerColumn', parseInt(this.value)||1)"></label>
          <div class="rl-configspacer"></div>
        </div>`;
      body = `
        <div class="rl-rowtabs">${tabsHtml}</div>
        ${configHtml}
        ${renderRackVisual(activeRow)}
      `;
    } else if (state.screen === 'table') {
      body = renderTable();
    }

    root.innerHTML = `
      ${placingBanner()}
      <div class="rl-top">
        <div>
          <div class="rl-eyebrow">Damen preorder system · ${esc(CURRENT_WH.name)}</div>
          <h1>${state.screen === 'overview' ? CURRENT_WH.name + ' overview' : esc(pageTitle)}</h1>
        </div>
        <div class="rl-navbtns">
          ${navExtra}
          <button class="rl-backbtn" onclick="RL.goFind()">Find an item</button>
          <div class="rl-viewtoggle">
            <button class="${state.screen === 'overview' || state.screen === 'rack' ? 'active' : ''}" onclick="RL.goOverview()">Rack view</button>
            <button class="${state.screen === 'table' ? 'active' : ''}" onclick="RL.setScreen('table')">Spreadsheet view</button>
          </div>
        </div>
      </div>
      <div class="rl-wrap">${body}</div>
      ${renderModal()}
      ${renderFloorModal()}
      ${catalogDatalists()}
      ${state.flash ? `<div class="rl-flash">${esc(state.flash)}</div>` : ''}
    `;
  }

  function renderDashboard() {
    const cards = Object.values(WAREHOUSES).map(wh => {
      const cache = whCache[wh.id] || { rows: [], data: {}, floorData: {} };
      let filled = 0, total = 0;
      cache.rows.forEach(row => {
        const l = wh.layout[row.id];
        total += l ? l.exists.size : 0;
        const d = cache.data[row.id] || {};
        Object.keys(d).forEach(code => { if (d[code] && d[code].length) filled++; });
      });
      let floorCount = 0;
      wh.floorIds.forEach(fid => { floorCount += (cache.floorData[fid] || []).length; });
      return `
        <div class="rl-whcard" onclick="RL.enterWarehouse('${wh.id}')">
          <div class="rl-whname">${esc(wh.name)}</div>
          <div class="rl-whstat">${filled}/${total} pallets stocked</div>
          <div class="rl-whstat">${floorCount} pallet(s) on floor storage</div>
          <div class="rl-whracks">${wh.rackIds.length} rack${wh.rackIds.length === 1 ? '' : 's'}</div>
        </div>`;
    }).join('');
    return `<div class="rl-whgrid">${cards}</div>`;
  }

  // Warehouse view: a birds-eye map of the whole site, from the hand-drawn sketch — five
  // buildings left to right (Fridge 60, Fridge 50, Fridge 40, Dry Produce flanked by two
  // hatched racking/dock-strip walls, Freezer 30), with Dock markers along the front.
  function renderWarehouseMap() {
    const building = (id, name, sub, leftPct, topPct, wPct, hPct, clip, labelTopPct) => {
      const clipCss = clip ? clip.split(',').map(p => p.trim().split(/\s+/).map(v => parseFloat(v) + '%').join(' ')).join(', ') : '';
      const shape = clip ? `
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" style="position:absolute; inset:0; width:100%; height:100%; overflow:visible; pointer-events:none;">
          <polygon points="${clip.split(',').map(p => p.trim().split(/\s+/).map(v => parseFloat(v)).join(',')).join(' ')}"
                   fill="#F6F2E9" stroke="#1E3A6B" stroke-width="3" vector-effect="non-scaling-stroke" stroke-linejoin="miter"></polygon>
        </svg>` : '';
      return `
      <div style="position:absolute; left:${leftPct}%; top:${topPct}%; width:${wPct}%; height:${hPct}%; box-sizing:border-box;
                  ${clip ? '' : 'cursor:pointer; background:linear-gradient(180deg, #FBFAF7 0%, #F3EFE6 100%); border:3px solid #1E3A6B; border-radius:4px; transition:background 0.1s ease;'}"
           ${clip ? '' : `onclick="RL.enterWarehouse('${id}')" title="${esc(name)} — click to open" onmouseenter="RL.mapHover(this, true)" onmouseleave="RL.mapHover(this, false)"`}>
        ${shape}
        ${clip ? `<div onclick="RL.enterWarehouse('${id}')" title="${esc(name)} — click to open"
             onmouseenter="RL.mapHover(this.parentElement, true)" onmouseleave="RL.mapHover(this.parentElement, false)"
             style="position:absolute; inset:0; clip-path:polygon(${clipCss}); cursor:pointer;"></div>` : ''}
        <div style="position:absolute; left:0; right:0; top:0; ${labelTopPct != null ? `bottom:${100 - labelTopPct}%;` : 'bottom:0;'} display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px; pointer-events:none;">
          <div style="font-family:'Barlow Condensed',sans-serif; font-weight:700; font-size:clamp(11px,1.6vw,20px); text-transform:uppercase; letter-spacing:0.4px; color:#1E1E1C; text-align:center;">${esc(name)}</div>
          ${sub ? `<div style="font-family:'JetBrains Mono',monospace; font-size:clamp(9px,1vw,12px); color:#8A877C;">${esc(sub)}</div>` : ''}
        </div>
      </div>`;
    };
    const hatchStrip = (leftPct, topPct, wPct, hPct) => `
      <div style="position:absolute; left:${leftPct}%; top:${topPct}%; width:${wPct}%; height:${hPct}%; box-sizing:border-box;
                  border:2px solid #1E3A6B; border-radius:2px;
                  background:repeating-linear-gradient(45deg, #1E3A6B 0 2px, transparent 2px 10px),
                             repeating-linear-gradient(-45deg, #1E3A6B 0 2px, transparent 2px 10px);"
           title="Racking / dock-strip wall"></div>`;
    const dock = (leftPct, topPct, wPct, hPct) => `
      <div style="position:absolute; left:${leftPct}%; top:${topPct}%; width:${wPct}%; height:${hPct}%; box-sizing:border-box;
                  border:2px solid #1E3A6B; border-radius:3px; background:#FFFFFF;
                  display:flex; align-items:center; justify-content:center;
                  font-family:'JetBrains Mono',monospace; font-weight:700; font-size:clamp(8px,0.85vw,11px); color:#1E1E1C; text-transform:uppercase; letter-spacing:0.5px;">Dock</div>`;

    return `
      <div class="rl-warehouse">
        <div class="rl-sitemap-scroll"><div class="rl-sitemap" style="position:relative; width:100%; aspect-ratio:16/9; background:#FFFFFF; box-sizing:border-box;">
          <div style="position:absolute; left:0; right:0; top:0; bottom:21.5%; border:4px solid #1E1E1C; box-sizing:border-box; pointer-events:none;"></div>
          ${building('fridge60', 'Fridge 60', '', 4, 10, 50, 55, '0 0, 100 0, 100 30, 29 30, 29 100, 0 100', 30)}
          ${building('fridge50', 'Fridge 50', '', 23, 34, 12.5, 31)}
          ${building('fridge40', 'Fridge 40', '', 39, 34, 11, 26)}
          ${hatchStrip(54, 0, 2, 14)}
          ${hatchStrip(54, 24, 2, 46)}
          ${building('dry', 'Dry Produce 10', '', 57, 0, 16.5, 65)}
          ${hatchStrip(75, 0, 2, 70)}
          ${building('freezer', 'Freezer 30', '', 78, 0, 21, 48)}
          ${dock(8, 74, 7, 4.5)}
          ${dock(25.75, 74, 7, 4.5)}
          ${dock(41, 74, 7, 4.5)}
          ${dock(56, 74, 5, 4.5)}
          <div onclick="RL.enterWarehouseAtRack('dry', 14)" title="Rack #14 — click to open" onmouseenter="RL.mapHover(this, true)" onmouseleave="RL.mapHover(this, false)"
               style="position:absolute; left:61.5%; top:74%; width:4%; height:4.5%; box-sizing:border-box; cursor:pointer; border:2px solid #1E3A6B; border-radius:2px; background:#F6F2E9; display:flex; align-items:center; justify-content:center; font-family:'JetBrains Mono',monospace; font-weight:700; font-size:8px; color:#1E1E1C; transition:background 0.1s ease;">R14</div>
          ${dock(66.75, 74, 5, 4.5)}
          ${dock(81.5, 74, 9, 4.5)}
          <div onclick="RL.enterWarehouseAtRack('dry', 5)" title="Rack #5 — click to open" onmouseenter="RL.mapHover(this, true)" onmouseleave="RL.mapHover(this, false)"
               style="position:absolute; left:96%; top:60%; width:4%; height:18%; box-sizing:border-box; cursor:pointer; border:2px solid #1E3A6B; border-radius:2px; background:#F6F2E9; display:flex; align-items:center; justify-content:center; font-family:'JetBrains Mono',monospace; font-weight:700; font-size:9px; color:#1E1E1C; transition:background 0.1s ease;">R5</div>
        </div>
        </div>
      </div>`;
  }

  window.RL = {
    goDashboard() { state.warehouseId = null; state.screen = 'dashboard'; render(); },
    showMap() { state.warehouseId = null; state.screen = 'map'; render(); },
    mapHover(el, on) {
      const svgShape = el.querySelector('polygon');
      if (svgShape) {
        svgShape.setAttribute('fill', on ? '#FFF3B0' : '#F6F2E9');
      } else {
        el.style.background = on ? '#FFF3B0' : 'linear-gradient(180deg, #FBFAF7 0%, #F3EFE6 100%)';
      }
    },
    enterWarehouse(whId) { switchWarehouse(whId); },
    async enterWarehouseAtRack(whId, rackId) {
      const wh = WAREHOUSES[whId];
      if (!wh) return;
      if (!whCache[whId]) await loadWarehouseData(whId);
      const cache = whCache[whId];
      CURRENT_WH = wh;
      RACK_IDS = wh.rackIds;
      RACK_LAYOUT = wh.layout;
      FLOOR_IDS = wh.floorIds;
      state.warehouseId = whId;
      state.rows = cache.rows;
      state.data = cache.data;
      state.floorData = cache.floorData;
      state.activeRowId = rackId;
      state.screen = 'rack';
      render();
    },
    goOverview() { state.screen = 'overview'; render(); },
    goToRack(id) { state.activeRowId = id; state.screen = 'rack'; render(); },
    setActiveRow(id) { state.activeRowId = id; render(); },
    setScreen(s) { state.screen = s; render(); },
    updateField: updateRowField,
    openEditor, closeEditor,

    dragStart(event, rowId, code) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', JSON.stringify({ rowId, code }));
    },
    dragOver(event) { event.preventDefault(); },
    dragEnter(event, el) {
      event.preventDefault();
      el.classList.add(el.classList.contains('filled') ? 'rl-drop-bad' : 'rl-drop-ok');
    },
    dragLeave(event, el) {
      el.classList.remove('rl-drop-ok', 'rl-drop-bad');
    },
    dropOn(event, targetRowId, targetCode) {
      event.preventDefault();
      event.currentTarget.classList.remove('rl-drop-ok', 'rl-drop-bad');

      let src;
      try { src = JSON.parse(event.dataTransfer.getData('text/plain')); } catch (e) { return; }
      if (!src) return;
      if (src.rowId === targetRowId && src.code === targetCode) return; // dropped on itself

      const targetItems = cellItems(targetRowId, targetCode);
      if (targetItems.length) {
        showFlash('Cannot do this — ' + targetRowId + '-' + targetCode + ' already has a pallet.');
        return;
      }

      const srcItems = cellItems(src.rowId, src.code);
      const srcParts = src.code.split('-'), tgtParts = targetCode.split('-');
      srcItems.forEach(it => logAudit('moved', {
        sku: it.sku, desc: it.description, qty: it.quantity, wh: CURRENT_WH.name,
        from: fullLoc(src.rowId, srcParts[0], srcParts[1]), to: fullLoc(targetRowId, tgtParts[0], tgtParts[1])
      }));
      setCellItems(targetRowId, targetCode, srcItems);
      setCellItems(src.rowId, src.code, []);
      saveData();
      render();
    },

    openFloorEditor(floorId) {
      const items = floorItems(floorId).map(i => ({ sku: i.sku || '', description: i.description || '', quantity: i.quantity != null ? i.quantity : 1 }));
      state.floorEditing = { floorId, items, itemMoveIndex: null, itemMoveTarget: null };
      render();
    },
    closeFloorEditor() { state.floorEditing = null; render(); },
    addFloorItem() {
      state.floorEditing.items.push({ sku: '', description: '', quantity: 1 });
      render();
    },
    removeFloorItem(i) {
      state.floorEditing.items.splice(i, 1);
      render();
    },
    updateFloorItemField(i, field, value) {
      state.floorEditing.items[i][field] = value;
    },
    async submitFloorEditor() {
      const e = state.floorEditing;
      const cleaned = e.items.filter(it => it.sku.trim() || it.description.trim())
        .map(it => ({ sku: it.sku.trim(), description: it.description.trim(), quantity: it.quantity || 1 }));
      // Refresh everyone else's items first, then change only this floor area.
      await mergeFloorDataFromServer();
      logItemDiff(CURRENT_WH.floorLabel(e.floorId), CURRENT_WH.name, floorItems(e.floorId), cleaned);
      setFloorItems(e.floorId, cleaned);
      await saveFloorData();
      state.floorEditing = null;
      state.placing = null;
      render();
    },

    addItem() {
      if (state.editing.items.length >= MAX_ITEMS) return;
      state.editing.items.push({ sku: '', description: '', quantity: 1 });
      render();
    },
    removeItem(i) {
      state.editing.items.splice(i, 1);
      render();
    },
    updateItemField(i, field, value) {
      state.editing.items[i][field] = value;
    },
    async submitEditor() {
      const e = state.editing;
      const cleaned = e.items.filter(it => it.sku.trim() || it.description.trim())
        .map(it => ({ sku: it.sku.trim(), description: it.description.trim(), quantity: it.quantity || 1 }));
      // Refresh everyone else's items first, then change only this slot.
      await mergeRackDataFromServer();
      const before = cellItems(e.rowId, e.level + '-' + e.pos);
      logItemDiff(fullLoc(e.rowId, e.level, e.pos), CURRENT_WH.name, before, cleaned);
      setCellItems(e.rowId, e.level + '-' + e.pos, cleaned);
      await saveData();
      state.editing = null;
      state.placing = null;
      render();
    },
    pickItemField(i, field, value) {
      const it = state.editing.items[i];
      if (!it) return;
      it[field] = value;
      // Clearing the item code clears its description too.
      if (field === 'sku' && !String(value).trim()) it.description = '';
      let cat = field === 'sku' ? catalogByCode(value) : (catalogByDesc(value) || catalogByCode(value));
      if (cat) { it.sku = cat.c; it.description = cat.d; }
      render();
    },
    pickFloorItemField(i, field, value) {
      const it = state.floorEditing.items[i];
      if (!it) return;
      it[field] = value;
      // Clearing the item code clears its description too.
      if (field === 'sku' && !String(value).trim()) it.description = '';
      let cat = field === 'sku' ? catalogByCode(value) : (catalogByDesc(value) || catalogByCode(value));
      if (cat) { it.sku = cat.c; it.description = cat.d; }
      render();
    },

    /* --- inventory navigation --- */
    goFind() { state.screen = 'find'; render(); },
    goCatalog() { state.screen = 'catalog'; render(); },
    goAudit() { state.screen = 'audit'; render(); },
    setFindQuery(v) { state.findQuery = v; renderKeepingFocus(); },
    setCatalogQuery(v) { state.catalogQuery = v; renderKeepingFocus(); },
    setFindView(v) { state.findView = v; render(); },
    setCatalogFilter(v) { state.catalogFilter = v; render(); },
    findItem(code) { state.findQuery = code; state.screen = 'find'; render(); },
    startPlacing(sku, description) {
      state.placing = { sku: sku, description: description };
      state.screen = 'map';
      render();
      showFlash('Pick a warehouse, then tap the pallet slot for ' + (sku || description) + '.');
    },
    cancelPlacing() { state.placing = null; render(); },
    async goToLocation(whId, rowId, level, pos) {
      if (whId !== state.warehouseId) await switchWarehouse(whId);
      state.activeRowId = rowId;
      state.screen = 'rack';
      openEditor(rowId, level, pos);
    },
    async goToFloor(whId, floorId) {
      if (whId !== state.warehouseId) await switchWarehouse(whId);
      state.screen = 'overview';
      RL.openFloorEditor(floorId);
    },

    toggleMove() { state.editing.showMove = !state.editing.showMove; render(); },
    setMoveField(field, value) {
      state.editing.moveTarget[field] = value;
      if (field === 'whId') {
        const targetRows = (whCache[value] && whCache[value].rows) || [];
        state.editing.moveTarget.rowId = targetRows[0] ? targetRows[0].id : null;
        const levels = (WAREHOUSES[value].layout[state.editing.moveTarget.rowId] || {}).levelsOrder || [];
        state.editing.moveTarget.level = levels[0];
        state.editing.moveTarget.pos = 1;
      } else if (field === 'rowId') {
        const levels = WAREHOUSES[state.editing.moveTarget.whId].layout[value].levelsOrder;
        if (!levels.includes(state.editing.moveTarget.level)) state.editing.moveTarget.level = levels[0];
      }
      render();
    },
    confirmMove() {
      const e = state.editing;
      const src = { whId: state.warehouseId, rowId: e.rowId, code: e.level + '-' + e.pos };
      const tgt = { whId: e.moveTarget.whId, rowId: e.moveTarget.rowId, code: e.moveTarget.level + '-' + e.moveTarget.pos };
      if (src.whId === tgt.whId && src.rowId === tgt.rowId && src.code === tgt.code) { alert('Pick a different location to move to.'); return; }

      const targetWh = WAREHOUSES[tgt.whId];
      const targetLayout = targetWh.layout[tgt.rowId];
      if (!targetLayout || !targetLayout.exists.has(tgt.code)) {
        alert(tgt.rowId + '-' + tgt.code + ' does not exist in ' + targetWh.name + '.');
        return;
      }

      const sourceItems = e.items.filter(it => it.sku.trim() || it.description.trim())
        .map(it => ({ sku: it.sku.trim(), description: it.description.trim(), quantity: it.quantity || 1 }));

      const targetCache = whCache[tgt.whId];
      const targetItems = (targetCache.data[tgt.rowId] && targetCache.data[tgt.rowId][tgt.code]) || [];

      if (targetItems.length && !confirm('That location already has ' + targetItems.length + " item(s) in " + targetWh.name + ". Swap the two pallets' contents?")) return;

      // write the moved pallet into the target warehouse's data
      if (!targetCache.data[tgt.rowId]) targetCache.data[tgt.rowId] = {};
      if (sourceItems.length) targetCache.data[tgt.rowId][tgt.code] = sourceItems;
      else delete targetCache.data[tgt.rowId][tgt.code];

      const srcLabel = fullLoc(src.rowId, e.level, e.pos);
      const tgtLabel = fullLoc(tgt.rowId, e.moveTarget.level, e.moveTarget.pos) + (tgt.whId !== src.whId ? ' (' + targetWh.name + ')' : '');
      sourceItems.forEach(it => logAudit(targetItems.length ? 'swapped' : 'moved', {
        sku: it.sku, desc: it.description, qty: it.quantity, wh: CURRENT_WH.name, from: srcLabel, to: tgtLabel
      }));
      targetItems.forEach(it => logAudit('swapped', {
        sku: it.sku, desc: it.description, qty: it.quantity, wh: targetWh.name, from: tgtLabel, to: srcLabel
      }));

      // write whatever was at the target (for a swap) back into the source slot
      setCellItems(src.rowId, src.code, targetItems);

      saveData();
      if (tgt.whId !== src.whId) saveDataForWarehouse(tgt.whId);

      state.editing = null;
      if (tgt.whId === state.warehouseId) {
        state.activeRowId = tgt.rowId;
        state.screen = 'rack';
      }
      render();
    },

    toggleItemMove(i) {
      const e = state.editing;
      if (e.itemMoveIndex === i) {
        e.itemMoveIndex = null;
      } else {
        e.itemMoveIndex = i;
        e.itemMoveTarget = { whId: state.warehouseId, rowId: e.rowId, level: e.level, pos: e.pos };
      }
      render();
    },
    setItemMoveField(field, value) {
      const e = state.editing;
      e.itemMoveTarget[field] = value;
      if (field === 'whId') {
        const targetRows = (whCache[value] && whCache[value].rows) || [];
        e.itemMoveTarget.rowId = targetRows[0] ? targetRows[0].id : null;
        const levels = (WAREHOUSES[value].layout[e.itemMoveTarget.rowId] || {}).levelsOrder || [];
        e.itemMoveTarget.level = levels[0];
        e.itemMoveTarget.pos = 1;
      } else if (field === 'rowId') {
        const levels = WAREHOUSES[e.itemMoveTarget.whId].layout[value].levelsOrder;
        if (!levels.includes(e.itemMoveTarget.level)) e.itemMoveTarget.level = levels[0];
      }
      render();
    },
    confirmItemMove() {
      const e = state.editing;
      const i = e.itemMoveIndex;
      if (i == null || !e.items[i]) return;
      const item = { sku: (e.items[i].sku || '').trim(), description: (e.items[i].description || '').trim(), quantity: e.items[i].quantity || 1 };
      if (!item.sku && !item.description) { alert('This item is empty — nothing to move.'); return; }

      const t = e.itemMoveTarget;
      const srcCode = e.level + '-' + e.pos;
      const tgtCode = t.level + '-' + t.pos;
      if (t.whId === state.warehouseId && t.rowId === e.rowId && tgtCode === srcCode) {
        alert('Pick a different pallet to move this item to.');
        return;
      }

      const targetWh = WAREHOUSES[t.whId];
      const targetLayout = targetWh.layout[t.rowId];
      if (!targetLayout || !targetLayout.exists.has(tgtCode)) {
        alert(t.rowId + '-' + tgtCode + ' does not exist in ' + targetWh.name + '.');
        return;
      }

      const targetCache = whCache[t.whId];
      if (!targetCache.data[t.rowId]) targetCache.data[t.rowId] = {};
      const existingTarget = targetCache.data[t.rowId][tgtCode] || [];
      if (existingTarget.length >= MAX_ITEMS) {
        alert('That pallet already has the maximum of ' + MAX_ITEMS + ' items.');
        return;
      }

      // remove the item from the pallet currently open in the editor
      e.items.splice(i, 1);
      const remainingSourceItems = e.items.filter(it => it.sku.trim() || it.description.trim())
        .map(it => ({ sku: it.sku.trim(), description: it.description.trim(), quantity: it.quantity || 1 }));
      setCellItems(e.rowId, srcCode, remainingSourceItems);

      // add it onto the target pallet
      targetCache.data[t.rowId][tgtCode] = [...existingTarget, item];
      logAudit('moved', {
        sku: item.sku, desc: item.description, qty: item.quantity, wh: CURRENT_WH.name,
        from: fullLoc(e.rowId, e.level, e.pos),
        to: fullLoc(t.rowId, t.level, t.pos) + (t.whId !== state.warehouseId ? ' (' + targetWh.name + ')' : '')
      });

      saveData();
      if (t.whId !== state.warehouseId) saveDataForWarehouse(t.whId);

      e.itemMoveIndex = null;
      const dt = depthInfo(t.rowId, t.rowId + '-' + tgtCode);
      const displayTgt = dt.clean + (dt.tag && dt.tag !== 'Front' ? dt.suffix : '');
      showFlash('Moved item to ' + displayTgt + (t.whId !== state.warehouseId ? ' in ' + targetWh.name : '') + '.');
    },

    // Jump straight from the spreadsheet view into a pallet's per-item move panel.
    moveItemFromTable(rowId, level, pos, itemIndex) {
      openEditor(rowId, level, pos);
      state.editing.itemMoveIndex = itemIndex;
      state.editing.itemMoveTarget = { whId: state.warehouseId, rowId, level, pos };
      render();
    },

    toggleFloorItemMove(i) {
      const e = state.floorEditing;
      if (e.itemMoveIndex === i) {
        e.itemMoveIndex = null;
      } else {
        const firstRow = state.rows[0];
        e.itemMoveIndex = i;
        e.itemMoveTarget = { whId: state.warehouseId, rowId: firstRow.id, level: RACK_LAYOUT[firstRow.id].levelsOrder[0], pos: 1 };
      }
      render();
    },
    setFloorItemMoveField(field, value) {
      const e = state.floorEditing;
      e.itemMoveTarget[field] = value;
      if (field === 'whId') {
        const targetRows = (whCache[value] && whCache[value].rows) || [];
        e.itemMoveTarget.rowId = targetRows[0] ? targetRows[0].id : null;
        const levels = (WAREHOUSES[value].layout[e.itemMoveTarget.rowId] || {}).levelsOrder || [];
        e.itemMoveTarget.level = levels[0];
        e.itemMoveTarget.pos = 1;
      } else if (field === 'rowId') {
        const levels = WAREHOUSES[e.itemMoveTarget.whId].layout[value].levelsOrder;
        if (!levels.includes(e.itemMoveTarget.level)) e.itemMoveTarget.level = levels[0];
      }
      render();
    },
    confirmFloorItemMove() {
      const e = state.floorEditing;
      const i = e.itemMoveIndex;
      if (i == null || !e.items[i]) return;
      const item = { sku: (e.items[i].sku || '').trim(), description: (e.items[i].description || '').trim(), quantity: e.items[i].quantity || 1 };
      if (!item.sku && !item.description) { alert('This item is empty — nothing to move.'); return; }

      const t = e.itemMoveTarget;
      const tgtCode = t.level + '-' + t.pos;
      const targetWh = WAREHOUSES[t.whId];
      const targetLayout = targetWh.layout[t.rowId];
      if (!targetLayout || !targetLayout.exists.has(tgtCode)) {
        alert(t.rowId + '-' + tgtCode + ' does not exist in ' + targetWh.name + '.');
        return;
      }

      const targetCache = whCache[t.whId];
      if (!targetCache.data[t.rowId]) targetCache.data[t.rowId] = {};
      const existingTarget = targetCache.data[t.rowId][tgtCode] || [];
      if (existingTarget.length >= MAX_ITEMS) {
        alert('That pallet already has the maximum of ' + MAX_ITEMS + ' items.');
        return;
      }

      // remove it from floor storage
      e.items.splice(i, 1);
      const remainingItems = e.items.filter(it => it.sku.trim() || it.description.trim())
        .map(it => ({ sku: it.sku.trim(), description: it.description.trim(), quantity: it.quantity || 1 }));
      setFloorItems(e.floorId, remainingItems);
      saveFloorData();

      // add it onto the target rack pallet
      targetCache.data[t.rowId][tgtCode] = [...existingTarget, item];
      logAudit('moved', {
        sku: item.sku, desc: item.description, qty: item.quantity, wh: CURRENT_WH.name,
        from: CURRENT_WH.floorLabel(e.floorId),
        to: fullLoc(t.rowId, t.level, t.pos) + (t.whId !== state.warehouseId ? ' (' + targetWh.name + ')' : '')
      });
      saveData();
      if (t.whId !== state.warehouseId) saveDataForWarehouse(t.whId);

      e.itemMoveIndex = null;
      const dt = depthInfo(t.rowId, t.rowId + '-' + tgtCode);
      const displayTgt = dt.clean + (dt.tag && dt.tag !== 'Front' ? dt.suffix : '');
      showFlash('Moved item to ' + displayTgt + (t.whId !== state.warehouseId ? ' in ' + targetWh.name : '') + '.');
    },

    // Jump straight from the spreadsheet view into a floor pallet's move panel.
    moveFloorItemFromTable(floorId, itemIndex) {
      RL.openFloorEditor(floorId);
      RL.toggleFloorItemMove(itemIndex);
    },

    quickSaveItem(rowId, code, itemIndex, sku, description) {
      const items = cellItems(rowId, code).map(i => ({ sku: i.sku, description: i.description, quantity: i.quantity != null ? i.quantity : 1 }));
      if (!items[itemIndex]) return;
      if (sku !== null) items[itemIndex].sku = sku;
      if (description !== null) items[itemIndex].description = description;
      logItemDiff(fullLoc(rowId, code.split('-')[0], code.split('-')[1]), CURRENT_WH.name, cellItems(rowId, code), items);
      setCellItems(rowId, code, items);
      saveData();
      render();
    },
    quickSaveItemQty(rowId, code, itemIndex, qty) {
      const items = cellItems(rowId, code).map(i => ({ sku: i.sku, description: i.description, quantity: i.quantity != null ? i.quantity : 1 }));
      if (!items[itemIndex]) return;
      items[itemIndex].quantity = parseInt(qty, 10) || 0;
      logItemDiff(fullLoc(rowId, code.split('-')[0], code.split('-')[1]), CURRENT_WH.name, cellItems(rowId, code), items);
      setCellItems(rowId, code, items);
      saveData();
      render();
    },
    quickSaveFloorItem(floorId, itemIndex, sku, description) {
      const items = floorItems(floorId).map(i => ({ sku: i.sku, description: i.description, quantity: i.quantity != null ? i.quantity : 1 }));
      if (!items[itemIndex]) return;
      if (sku !== null) items[itemIndex].sku = sku;
      if (description !== null) items[itemIndex].description = description;
      setFloorItems(floorId, items);
      saveFloorData();
      render();
    },
    quickSaveFloorItemQty(floorId, itemIndex, qty) {
      const items = floorItems(floorId).map(i => ({ sku: i.sku, description: i.description, quantity: i.quantity != null ? i.quantity : 1 }));
      if (!items[itemIndex]) return;
      items[itemIndex].quantity = parseInt(qty, 10) || 0;
      setFloorItems(floorId, items);
      saveFloorData();
      render();
    },
    setSearch(v) { state.search = v; renderKeepingFocus(); },
    exportCsv() {
      const items = allItemRows();
      let csv = 'Location,Rack,SKU,Description,Qty\n';
      items.forEach(it => {
        const esc2 = s => '"' + String(s || '').replace(/"/g, '""') + '"';
        csv += [esc2(it.full), esc2(it.rowName), esc2(it.sku), esc2(it.description), esc2(it.quantity)].join(',') + '\n';
      });
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = CURRENT_WH.id + '-rack-locations.csv';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
    // Export the Find spreadsheet — every placed item and its location across all
    // warehouses, matching the current search filter and the on-screen columns.
    exportFindCsv() {
      const q = state.findQuery.trim().toLowerCase();
      let rows = allItemRowsGlobal().map(p => {
        const cat = catalogByCode(p.sku) || catalogByDesc(p.description);
        return {
          code: cat ? cat.c : p.sku,
          desc: cat ? cat.d : p.description,
          full: p.full,
          wh: p.whName + (p.isFloor ? '' : ' · ' + p.rowName),
          whName: p.whName,
          rowName: p.rowName || '',
          qty: p.quantity,
        };
      });
      if (q) rows = rows.filter(p =>
        (p.code + ' ' + p.desc + ' ' + p.full + ' ' + p.whName + ' ' + p.rowName).toLowerCase().includes(q));
      rows.sort((a, b) =>
        (a.desc || '').localeCompare(b.desc || '') || a.full.localeCompare(b.full, undefined, { numeric: true }));
      const esc2 = s => '"' + String(s == null ? '' : s).replace(/"/g, '""') + '"';
      let csv = 'Item code,Description,Location,Warehouse,Qty\n';
      rows.forEach(p => { csv += [esc2(p.code), esc2(p.desc), esc2(p.full), esc2(p.wh), esc2(p.qty)].join(',') + '\n'; });
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'warehouse-inventory.csv';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
    resetAll() {
      if (!confirm('This clears all saved pallet data for ' + CURRENT_WH.name + ', including floor storage. Rack layout is kept. Continue?')) return;
      logAudit('cleared', { wh: CURRENT_WH.name, desc: 'All pallet data for ' + CURRENT_WH.name });
      state.data = {};
      state.floorData = {};
      whCache[state.warehouseId].data = state.data;
      whCache[state.warehouseId].floorData = state.floorData;
      saveData();
      saveFloorData();
      render();
    }
  };

  loadState();
  setupCatalogAutocomplete();

  }

  class RackLocatorApp extends HTMLElement {
    connectedCallback() {
      if (this._rlInit) return;
      this._rlInit = true;
      if (!document.getElementById('rack-locator-styles')) {
        const style = document.createElement('style');
        style.id = 'rack-locator-styles';
        style.textContent = CSS_TEXT;
        document.head.appendChild(style);
      }
      this.style.display = 'block';
      this.style.width = '100%';
      this.style.minHeight = '100%';
      this.innerHTML = '<div id="rl-root"><div class="rl-loading">Loading warehouse data\u2026</div></div>';
      initRackLocator(this);
    }
  }
  if (!customElements.get('rack-locator-app')) customElements.define('rack-locator-app', RackLocatorApp);
})();
