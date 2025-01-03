#!/usr/bin/env node
import { ArgumentParser, ArgumentDefaultsHelpFormatter, ArgumentTypeError, SUPPRESS } from 'argparse'
import { lstatSync, readFileSync } from 'node:fs'
import { readdir, readFile, writeFile, cp, mkdir } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import 'fresh-console'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const packageInfo = JSON.parse(readFileSync(join(__dirname, 'package.json')))

function directoryPath(path) {
    if (path === SUPPRESS) throw new ArgumentTypeError('Directory path is required!')
    let stats
    try {
        stats = lstatSync(path)
    } catch (e) {
        throw new ArgumentTypeError(`${path} is not a valid path! (${e})`)
    }
    if (!stats.isDirectory()) throw new ArgumentTypeError(`${path} is not a valid directory!`)
    return path
}

// eslint-disable-next-line camelcase
const parser = new ArgumentParser({ add_help: true, description: packageInfo.description, formatter_class: ArgumentDefaultsHelpFormatter })
parser.add_argument('-v', '--version', { action: 'version', version: packageInfo.version })
parser.add_argument('directory', { nargs: '?', help: 'Directory containing samples', type: directoryPath, default: SUPPRESS })
parser.add_argument('--template', { help: 'JSON Template to use', default: join(__dirname, '..', 'template.json') })
parser.add_argument('--key-start', { help: 'Starting key to use', default: 53, type: Number })
const args = parser.parse_args()

console.info(`--- ${packageInfo.description} v${packageInfo.version} ---`)

// Read template
let contents
try {
    contents = readFileSync(args.template, 'utf8')
} catch (e) {
    console.error(`Unable to read template file! ${e}`)
    process.exit(1)
}

// Check valid syntax
let patch
try {
    patch = JSON.parse(contents)
} catch (e) {
    console.error(`Unable to parse template JSON - is the syntax valid? (${e})`)
    process.exit(1)
}

// Set starting key
let key = args.key_start

// Use directory name as preset name
const presetName = basename(args.directory).replace(/\.preset$/, '')
const presetSamples = []

// Read directory contents
const files = await readdir(args.directory)
for (const file of files) {
    // Only add wav/aiff files
    if (!file.match(/\.wav|\.aiff$/i)) continue

    // Determine framecount
    const buffer = await readFile(join(args.directory, file))
    // Subtracting 88 bytes for wrapper/headers
    const framecount = (buffer.length - 88) / 2

    // Add to patch file
    patch.regions.push({
        'fade.in': 0,
        'fade.out': 0,
        framecount,
        hikey: key,
        lokey: key,
        pan: 0,
        'pitch.keycenter': 60,
        playmode: 'oneshot',
        reverse: false,
        sample: file,
        'sample.end': framecount,
        transpose: 0,
        tune: 0
    })
    key++

    presetSamples.push(file)
}
const totalProcessed = key - args.key_start
if (!totalProcessed) {
    console.error('No wav or aiff files were found! Is this the right directory?')
    process.exit(1)
}

console.success(`${totalProcessed} files successfully processed. Creating preset...`)

// Make new preset directory
let i = 2
let success = false
const parent = dirname(args.directory)
let presetPath = join(parent, `${presetName}.preset`)
while (!success) {
    try {
        await mkdir(presetPath)
        success = true
    } catch (e) {
        console.debug(`${presetPath} already exists. Trying again... (${e})`)
        presetPath = join(parent, `${presetName}-${i++}.preset`)
    }
}

// Save samples to preset directory
const tasks = []
for (const sample of presetSamples) {
    tasks.push(cp(join(args.directory, sample), join(presetPath, sample)))
}

// Save patch to preset directory
const destination = join(presetPath, 'patch.json')
tasks.push(writeFile(destination, JSON.stringify(patch)))

await Promise.all(tasks)
console.success(`Patch file successfully written to ${destination}`)
