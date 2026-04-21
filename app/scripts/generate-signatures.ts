import satori from 'satori'
import { Resvg } from '@resvg/resvg-js'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'

const SIGNATORIES = [
  'Juan Dela Cruz', 'Maria Santos', 'Jose Reyes', 'Ana Garcia',
  'Roberto Tan', 'Lucia Lim', 'Eduardo Cruz', 'Isabella Reyes',
]

async function main() {
  const outDir = path.resolve(__dirname, '../public/signatures')
  await mkdir(outDir, { recursive: true })

  const fontBytes = await readFile(path.resolve(__dirname, './Caveat-Regular.ttf'))

  for (let i = 0; i < SIGNATORIES.length; i++) {
    const svg = await satori(
      {
        type: 'div',
        props: {
          style: {
            display: 'flex', width: '400px', height: '120px',
            alignItems: 'center', justifyContent: 'center',
            fontFamily: 'Caveat', fontSize: 64, color: '#0b2545',
          },
          children: SIGNATORIES[i],
        },
      },
      { width: 400, height: 120, fonts: [{ name: 'Caveat', data: fontBytes, weight: 400, style: 'normal' }] }
    )
    const png = new Resvg(svg, { fitTo: { mode: 'width', value: 400 } }).render().asPng()
    await writeFile(path.join(outDir, `demo-sig-${i + 1}.png`), png)
    console.log(`generated demo-sig-${i + 1}.png`)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
