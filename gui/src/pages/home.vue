<template>
    <main>
        <div>
            <h1>OP-XY Preset Generator</h1>
            <transition name="fly-in">
                <p class="status" v-if="status">
                    {{ status }}
                </p>
            </transition>
            <div
                :class="['dropzone', { active, processing }]"
                @drop.prevent="processDroppedFiles"
                @dragover.prevent
                @dragenter="highlight(true)"
                @dragleave="highlight(false)"
                @click="toggleFilePicker"
            >
                <p>{{ active ? 'Drop it!' : 'Drop a folder of samples here or click to browse' }}</p>
                <input
                    type="file"
                    webkitdirectory
                    multiple
                    ref="fileInput"
                    @change="processInputFiles"
                >
            </div>
            <footer>
                Created by <a href="https://github.com/foxxyz">@foxxyz</a> | Not affiliated or endorsed by TE | <a href="https://github.com/foxxyz/op-xy-patch-generator">Source on Github</a>
            </footer>
        </div>
    </main>
</template>

<script setup>
import PATCH_TEMPLATE from '../../../template.json'
import { strToU8, zip } from 'fflate'
import { ref } from 'vue'

const KEY_START = 53

const active = ref(false)
const processing = ref(false)
const status = ref()

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

async function scanDroppedFolder(items) {
    if (!items) throw new Error('No items found!')

    // Get directory from dropped items
    let directoryEntry
    for (const item of items) {
        directoryEntry = item.webkitGetAsEntry()
        if (!directoryEntry.isDirectory) throw new Error('Not a directory!')
        break
    }

    const folder = {
        name: directoryEntry.name.replace(/\.preset$/, ''),
        files: []
    }
    const reader = directoryEntry.createReader()
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

async function scanInputFolder(files) {
    const folder = {
        name: 'custom',
        files: []
    }
    for (const file of files) {
        // Only add wav/aiff files
        if (!file.name.match(/\.wav|\.aiff$/i)) continue

        folder.files.push({
            name: file.name,
            buffer: new Uint8Array(await file.arrayBuffer())
        })
    }

    if (!folder.files.length) throw new Error('No .wav or .aiff samples found in folder!')

    return folder
}

function createPatch({ files }) {
    // Sort files alphabetically
    files = files.sort((a, b) => a.name.localeCompare(b.name))

    let key = KEY_START
    const patch = structuredClone(PATCH_TEMPLATE)
    for (const { name, buffer } of files) {
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

    // Show status message
    status.value = `${files.length} files successfully processed`
    setTimeout(() => status.value = null, 8000)

    return patch
}

async function createPreset(folder) {
    processing.value = true
    try {
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
    } finally {
        processing.value = false
    }
}

async function processDroppedFiles(ev) {
    active.value = false
    try {
        const folder = await scanDroppedFolder(ev.dataTransfer.items)
        await createPreset(folder)
    } catch (e) {
        alert(e)
    }
}

async function processInputFiles(ev) {
    try {
        const folder = await scanInputFolder(ev.target.files)
        await createPreset(folder)
    } catch (e) {
        alert(e)
    }
}

function highlight(enabled) {
    active.value = enabled
}

const fileInput = ref()
function toggleFilePicker() {
    fileInput.value.click()
}
</script>

<style lang="sass">
main
    display: flex
    justify-content: center
    align-items: center
    height: 100%
    padding: 2rem
    overflow: hidden
    position: relative

    a
        color: inherit
        &:hover
            color: #999

    footer
        margin-top: 3rem
        font-size: .7em
        text-align: center
        color: #555

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
        pointer-events: none

    .dropzone
        border: solid 1px transparent
        border-radius: 1rem
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

        input
            display: none

    .status
        position: absolute
        user-select: none
        top: 3rem
        left: 50%
        font-weight: 100
        transform: translate(-50%, 0)
        border-radius: .5em
        padding: 1em 2em
        background: linear-gradient(to bottom, #141, #3c3)
        color: white

    @keyframes bgscroll
        from
            background-position: 0 0
        to
            background-position: 0 200%

    .fly-in-enter-active, .fly-in-leave-active
        transition: 1s cubic-bezier(.37,1.32,.41,1)
    .fly-in-enter-from
        transform: translate(calc(-50% + 200vw), 0) scale(5, 1)
    .fly-in-leave-to
        transform: translate(calc(-50% - 200vw), 0) scale(5, 1)
</style>
