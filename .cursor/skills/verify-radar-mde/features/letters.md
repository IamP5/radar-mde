# Action letters

On a municipality page, O que você pode fazer offers four letters already filled with that city's numbers. The person can add a name, edit a letter, copy it, and undo the edit. Radar MDE does not send the letter.

## Sub-features

- `letters-open` scrolls to the four choices.
- `letters-sign` puts the person's name into the letter.
- `letters-copy` copies the letter.
- `letters-switch` opens the Tribunal de Contas letter with the same name.
- `letters-undo` restores a letter after it was edited.

## How to get to it (user POV)

- On a city page, choose `O que posso fazer?`.
- Open `/sp/santo-andre#agir`.
- The four choices are `Pedir dados`, `Conselho`, `Câmara`, and `Fiscalização`.

## Driving it with control-radar-mde

Preconditions:

- `./scripts/control-radar-mde doctor` reports `ok: true` for this run.

- **Open the letters.** Run `./scripts/control-radar-mde browser open /sp/santo-andre`. Run `./scripts/control-radar-mde browser click --role button --name "O que posso fazer?"`. The URL hash is `#agir`. A level-2 heading named `O que você pode fazer` is visible.
- **Sign and copy the first letter.** Run `./scripts/control-radar-mde browser fill --label "Seu nome" --value "Ana Costa"`. Run `./scripts/control-radar-mde browser click --role button --name "Copiar texto"`. The button is now `Copiado`: `./scripts/control-radar-mde browser wait --role button --name "Copiado"`. Run `./scripts/control-radar-mde browser clipboard`. The text contains `Ana Costa` and `Santo André`.
- **Switch letter.** Run `./scripts/control-radar-mde browser click --role tab --name-regex "Fiscalização"`. Run `./scripts/control-radar-mde browser click --role button --name "Copiar texto"`. Run `./scripts/control-radar-mde browser clipboard`. The text contains `Ana Costa`, `Santo André`, and `Tribunal`.
- **Edit and undo.** Run `./scripts/control-radar-mde browser fill --role textbox --name-regex "Texto do modelo" --value "Texto editado pela pessoa."`. Run `./scripts/control-radar-mde browser wait --role button --name "Desfazer edições"`. Run `./scripts/control-radar-mde browser click --role button --name "Desfazer edições"`. Run `./scripts/control-radar-mde browser find --role button --name "Desfazer edições"`. The count is 0. Run `./scripts/control-radar-mde browser click --role button --name "Copiar texto"`. Run `./scripts/control-radar-mde browser clipboard`. The text contains `Santo André` and does not contain `Texto editado pela pessoa.`.
- **Proof.** Run `./scripts/control-radar-mde browser screenshot --path letters/restored.png` and `./scripts/control-radar-mde browser snapshot --aria --path letters/restored.aria.txt`. The screenshot shows the Radar MDE header and `O que você pode fazer`.

## Gotchas

- `O que posso fazer?` is a button that moves to `#agir`, not the heading. The heading is `O que você pode fazer`.
- WhatsApp and E-mail are on the letter. They leave Radar MDE (a chat link, or a mail draft). This recipe copies the text and does not follow those two.
- The name is typed once and is reused when the letter changes. It is not sent anywhere.
- `Desfazer edições` exists only while that letter differs from the original. After the undo it goes away.
- Copy confirmation (`Copiado`) returns to `Copiar texto` after a short moment. Read the clipboard in the same step.
- `browser text` reads the visible text of a control, which is empty for this letter field. The copied text is the proof of what the letter says.
