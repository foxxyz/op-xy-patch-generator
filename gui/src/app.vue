<template>
    <router-view />
    <span class="version">v{{ version }}</span>
</template>

<script setup>
// Displays version set in package.json
const version = __APP_VERSION__
</script>

<style lang="sass">
@import url('https://fonts.googleapis.com/css2?family=Roboto+Flex:opsz,wght@8..144,100..1000&display=swap')

// Reset default styles
*
    margin: 0
    padding: 0
    box-sizing: border-box

// Set default color/background/font-size on root
body
    background: #000
    color: #fff
    font-size: 16px
    font-family: Roboto Flex, sans-serif
    font-weight: 300

// Use up at least available space
html, body
    height: 100%

// Reset input styles
input
    font-size: inherit
    font-family: inherit

.version
    position: absolute
    bottom: 0
    right: 0
    padding: .5em
    font-size: .7em

// Add font declarations here

// Add global animations here

</style>
