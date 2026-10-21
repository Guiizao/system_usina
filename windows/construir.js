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
  // 2.16: o programa é só o painel pela nuvem: vai o main.js e as telas (sem a central, sem o APK dos tablets)
  fs.copyFileSync(path.join(__dirname, 'main.js'), path.join(pacote, 'main.js'));
  fs.cpSync(path.join(raiz, 'public'), path.join(pacote, 'public'), { recursive: true });
  // como no APK: as partes do aplicativo viram um app.js só, embaralhado (quem abrir o instalador não lê o código)
  const { execFileSync } = require('node:child_process');
  const publico = path.join(pacote, 'public');
  execFileSync(process.execPath, [path.join(raiz, 'apk', 'juntar-app.js'), publico], { stdio: 'inherit' });
  const terser = path.join(raiz, 'apk', 'node_modules', 'terser', 'bin', 'terser');
  if (!fs.existsSync(terser)) console.log('Aviso: sem o terser (apk/node_modules), o código vai sem embaralhar.');
  else for (const js of fs.readdirSync(publico, { recursive: true }).filter((n) => n.endsWith('.js') && !n.endsWith('qrcode.js') && !/^lib[\\/]/.test(n))) {
    const arquivo = path.join(publico, js); // (qrcode.js e a pasta lib são de outros autores: vão como estão)
    execFileSync(process.execPath, [terser, arquivo, '--compress', '--mangle', '--comments', '/Guilherme/', '-o', arquivo]);
  }
  fs.copyFileSync(path.join(raiz, 'LICENCA.txt'), path.join(pacote, 'LICENCA.txt'));
  const { devDependencies, ...manifesto } = require('./package.json');
  fs.writeFileSync(path.join(pacote, 'package.json'), JSON.stringify({ ...manifesto, version: versao }, null, 2));
  console.log('Gerando Pranchetas Ubirálcool ' + versao);
  await build({ projectDir: pacote, targets: Platform.WINDOWS.createTarget('nsis', Arch.x64), config: {
    appId: 'br.com.ubiralcool.pranchetas', productName: 'Pranchetas Ubirálcool',
    electronVersion: devDependencies.electron,
    electronDist: path.join(__dirname, 'node_modules', 'electron', 'dist'),
    // sem asar: a central copia pastas (o APK dos tablets) e o fs dentro do asar não deixa; o código já vai embaralhado
    directories: { output: saida }, asar: false, npmRebuild: false,
    files: ['**/*'],
    win: { icon: path.join(pacote, 'public', 'icons', 'icon-512.png'), signExecutable: false },
    // sempre em Arquivos de Programas: fora dela (ex.: na Área de Trabalho) a parte isolada do Electron não lê a pasta e a janela fica branca
    nsis: { oneClick: false, perMachine: true, allowToChangeInstallationDirectory: false,
      include: path.join(__dirname, 'instalador.nsh'), deleteAppDataOnUninstall: false,
      artifactName: 'Pranchetas-Ubiralcool-${version}.exe', shortcutName: 'Pranchetas Ubirálcool' },
  } });
  const instalador = path.join(saida, `Pranchetas-Ubiralcool-${versao}.exe`);
  if (!fs.existsSync(instalador)) throw new Error('O electron-builder não produziu o instalador esperado: ' + instalador);
  console.log('Instalador pronto: ' + instalador);
}
construir().catch((erro) => { console.error(erro.stack || erro.message); process.exit(1); });
