<template>
    <main>
        <div>
            <h1>OP-XY Preset Generator</h1>
            <div
                :class="['dropzone', { active }]"
                @drop.prevent="processFiles"
                @dragover.prevent
                @dragenter="highlight(true)"
                @dragleave="highlight(false)"
            >
                <p>{{ active ? 'Drop it!' : 'Drop a folder of samples here or click to browse.' }}</p>
            </div>
        </div>
    </main>
</template>

<script setup>
import PATCH_TEMPLATE from '../../../template.json'
import { strToU8, zip } from 'fflate'
import { ref } from 'vue'

const KEY_START = 53

const active = ref(false)

async function compress(folder, files) {
    const archive = await new Promise((res, rej) => {
        zip({ [folder]: files }, (err, data) => {
            if (err) return rej(err)
            res(data)
        })
    })
    return new Blob([archive], { type: 'application/x-zip' })
}

function offerDownload(blob, filename) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename || 'download'
    const clickHandler = () => {
        setTimeout(() => {
            URL.revokeObjectURL(url)
            removeEventListener('click', clickHandler)
        })
    }
    a.addEventListener('click', clickHandler, false)
    a.click()
}

async function scanFolder(item) {
    const folder = {
        name: item.name.replace(/\.preset$/, ''),
        files: []
    }
    const reader = item.createReader()
    const entries = await new Promise((res, rej) => reader.readEntries(res, rej))
    for (const entry of entries) {
        // Only add wav/aiff files
        if (!entry.name.match(/\.wav|\.aiff$/i)) continue

        // Turn into buffer
        const file = await new Promise((res, rej) => entry.file(res, rej))

        folder.files.push({
            name: entry.name,
            buffer: new Uint8Array(await file.arrayBuffer())
        })
    }

    if (!folder.files.length) throw new Error('No .wav or .aiff samples found in folder!')

    return folder
}

function createPatch(folder) {
    let key = KEY_START
    const patch = structuredClone(PATCH_TEMPLATE)
    for (const { name, buffer } of folder.files) {
        // Determine framecount
        // Subtracting 88 bytes for wrapper/headers
        const framecount = (buffer.byteLength - 88) / 2

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
            sample: name,
            'sample.end': framecount,
            transpose: 0,
            tune: 0
        })
        key++
    }
    return patch
}

function extractFiles(items) {
    if (!items) throw new Error('No items found!')
    for (const item of items) {
        const entry = item.webkitGetAsEntry()
        if (!entry.isDirectory) throw new Error('Not a directory!')
        return scanFolder(entry)
    }
}

async function processFiles(ev) {
    try {
        const folder = await extractFiles(ev.dataTransfer.items)
        const presetName = `${folder.name}.preset`
        const patch = await createPatch(folder)
        const archive = await compress(presetName, {
            'patch.json': strToU8(JSON.stringify(patch)),
            ...folder.files.reduce((acc, v) => {
                acc[v.name] = v.buffer
                return acc
            }, {})
        })
        offerDownload(archive, `${presetName}.zip`)
    } catch (e) {
        alert(e)
    }
    active.value = false
}

function highlight(enabled) {
    active.value = enabled
}
</script>

<style lang="sass">
main
    display: flex
    justify-content: center
    align-items: center
    height: 100%

    h1
        font-size: 5em
        font-weight: 200
        text-transform: lowercase
        margin-bottom: .5em
        text-align: center

    p
        text-align: center
        font-size: .8em
        color: #888
        text-transform: lowercase

    .dropzone
        border: solid 1px transparent
        cursor: pointer
        display: flex
        justify-content: center
        align-items: center
        height: 8rem
        background: linear-gradient(to bottom, black, #444, black)
        animation: bgscroll 2s linear infinite
        background-size: 100% 200%
        &.active
            animation-duration: .5s
            border-color: #ccc
            font-size: 3em

    @keyframes bgscroll
        from
            background-position: 0 0
        to
            background-position: 0 200%
</style>
