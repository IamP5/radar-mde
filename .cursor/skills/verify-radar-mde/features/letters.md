# Action letters

On a municipality page, O que você pode fazer offers four letters already filled with that city's numbers. The person can add a name, edit a letter, copy it, and undo the edit. Radar MDE does not send the letter.

## Sub-features

- `letters-open` scrolls to the four choices.
- `letters-sign` puts the person's name into the letter.
- `letters-copy` copies the letter.
- `letters-switch` opens the Tribunal de Contas letter with the same name.
- `letters-undo` restores a letter after it was edited.
- `letters-whatsapp` records the WhatsApp link without leaving the page.
- `letters-mail` records the mailto link without leaving the page.

## How to get to it (user POV)

- On a city page, choose `O que posso fazer?`.
- Open `/sp/santo-andre#agir`.
- The four choices are `Pedir dados`, `Conselho`, `Câmara`, and `Fiscalização`.

## Driving it with control-radar-mde

Preconditions:

- `./scripts/control-radar-mde doctor` reports `ok: true` for this run.

- **Open the letters.** Run `./scripts/control-radar-mde browser open /sp/santo-andre`. Run `./scripts/control-radar-mde browser click --role link --name "O que posso fazer?"`. The URL hash is `#agir`. A level-2 heading named `O que você pode fazer` is visible.
- **Sign and copy the first letter.** Run `./scripts/control-radar-mde browser fill --label "Seu nome" --value "Ana Costa"`. Run `./scripts/control-radar-mde browser click --role button --name "Copiar texto"`. The button is now `Copiado`: `./scripts/control-radar-mde browser wait --role button --name "Copiado"`. Run `./scripts/control-radar-mde browser clipboard`. The text contains `Ana Costa` and `Santo André`.
- **Switch letter.** Run `./scripts/control-radar-mde browser click --role tab --name-regex "Fiscalização"`. Run `./scripts/control-radar-mde browser click --role button --name "Copiar texto"`. Run `./scripts/control-radar-mde browser clipboard`. The text contains `Ana Costa`, `Santo André`, and `Tribunal`.
- **Edit and undo.** Run `./scripts/control-radar-mde browser fill --role textbox --name-regex "Texto do modelo" --value "Texto editado pela pessoa."`. Run `./scripts/control-radar-mde browser text --role textbox --name-regex "Texto do modelo"`. The JSON `source` is `value` and the text is `Texto editado pela pessoa.`. Run `./scripts/control-radar-mde browser wait --role button --name "Desfazer edições"`. Run `./scripts/control-radar-mde browser click --role button --name "Desfazer edições"`. Run `./scripts/control-radar-mde browser find --role button --name "Desfazer edições"`. The count is 0. Run `./scripts/control-radar-mde browser text --role textbox --name-regex "Texto do modelo"`. The text contains `Santo André` and does not contain `Texto editado pela pessoa.`. Run `./scripts/control-radar-mde browser click --role button --name "Copiar texto"`. Run `./scripts/control-radar-mde browser clipboard`. The text contains `Santo André` and does not contain `Texto editado pela pessoa.`.
- **WhatsApp and e-mail.** Run `./scripts/control-radar-mde browser click --role button --name "WhatsApp" --exact`. The click's JSON `outbound` has an entry whose `kind` is `link` and whose `url` contains `wa.me`. Run `./scripts/control-radar-mde browser click --role button --name "E-mail" --exact`. The click's JSON `outbound` has an entry whose `kind` is `link` and whose `url` starts with `mailto:`. Run `./scripts/control-radar-mde browser outbound`. Both urls are in `entries`. Run `./scripts/control-radar-mde browser url`. The path is still `/sp/santo-andre`.
- **Proof.** Run `./scripts/control-radar-mde browser screenshot --path letters/restored.png` and `./scripts/control-radar-mde browser snapshot --aria --path letters/restored.aria.txt`. The screenshot shows the Radar MDE header and `O que você pode fazer`.

## Gotchas

- `O que posso fazer?` is a link to `#agir`, not the heading. The heading is `O que você pode fazer`.
- WhatsApp is a link to `wa.me` and E-mail is a `mailto:` link. The click stays on the city page. `outbound` on the click JSON, and `browser outbound`, record both.
- The name is typed once and is reused when the letter changes. It is not sent anywhere.
- `Desfazer edições` exists only while that letter differs from the original. After the undo it goes away.
- Copy confirmation (`Copiado`) returns to `Copiar texto` after a short moment. Read the clipboard in the same step.
- `browser text` on the letter field returns its value (`source` is `value`), including after an edit and after undo.
