/* Pranchetas Digitais - © 2026 Guilherme. */
const fs = require('node:fs');
const path = require('node:path');
const { build, Platform, Arch } = require('electron-builder');
const { lerVersao } = require('./pacote');

async function construir() {
  const raiz = path.resolve(__dirname, '..');
  const versao = lerVersao(path.join(raiz, 'public'));
  const saida = path.join(__dirname, 'saida');
  const pacote = path.join(saida, 'pacote');
  // Caminho fixo dentro da saída do build, nunca a pasta de dados da central.
  fs.rmSync(pacote, { recursive: true, force: true });
  fs.mkdirSync(pacote, { recursive: true });
  for (const nome of fs.readdirSync(raiz).filter((n) => n.endsWith('.js'))) fs.copyFileSync(path.join(raiz, nome), path.join(pacote, nome));
  for (const nome of ['main.js', 'pacote.js']) fs.copyFileSync(path.join(__dirname, nome), path.join(pacote, nome));
  fs.cpSync(path.join(raiz, 'public'), path.join(pacote, 'public'), { recursive: true });
  const apk = path.join(raiz, 'apk', 'saida');
  if (fs.existsSync(apk)) fs.cpSync(apk, path.join(pacote, 'apk', 'saida'), { recursive: true });
  else console.log('Aviso: apk/saida não existe; o instalador será gerado sem APK para os tablets.');
  fs.copyFileSync(path.join(raiz, 'LICENCA.txt'), path.join(pacote, 'LICENCA.txt'));
  const { devDependencies, ...manifesto } = require('./package.json');
  fs.writeFileSync(path.join(pacote, 'package.json'), JSON.stringify({ ...manifesto, version: versao }, null, 2));
  console.log('Gerando Pranchetas Ubirálcool ' + versao);
  await build({ projectDir: pacote, targets: Platform.WINDOWS.createTarget('nsis', Arch.x64), config: {
    appId: 'br.com.ubiralcool.pranchetas', productName: 'Pranchetas Ubirálcool',
    electronVersion: devDependencies.electron,
    electronDist: path.join(__dirname, 'node_modules', 'electron', 'dist'),
    directories: { output: saida }, asar: true, npmRebuild: false,
    files: ['**/*'],
    win: { icon: path.join(pacote, 'public', 'icons', 'icon-512.png'), signExecutable: false },
    nsis: { oneClick: false, perMachine: true, allowToChangeInstallationDirectory: true,
      include: path.join(__dirname, 'instalador.nsh'), deleteAppDataOnUninstall: false,
      artifactName: 'Pranchetas-Ubiralcool-${version}.exe', shortcutName: 'Pranchetas Ubirálcool' },
  } });
  const instalador = path.join(saida, `Pranchetas-Ubiralcool-${versao}.exe`);
  if (!fs.existsSync(instalador)) throw new Error('O electron-builder não produziu o instalador esperado: ' + instalador);
  console.log('Instalador pronto: ' + instalador);
}
construir().catch((erro) => { console.error(erro.stack || erro.message); process.exit(1); });
