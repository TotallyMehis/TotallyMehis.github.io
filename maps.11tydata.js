const fs = require('fs').promises
const { listMapImageFiles, getMaps } = require('./map')




/**
 * 
 * @param {string} mapname 
 * @param {string[]} images
 * @returns {MapImage[]}
 */
function getMapImages(mapname, images) {
  return images.filter(image => image.startsWith(mapname + '_')).map(image => {
    const extPos = image.lastIndexOf('.')
    const filenameNoExt = image.substring(0, extPos)
    const ext = image.substring(extPos)

    /** @type {MapImage} */
    return {
      thumb: filenameNoExt + '_thumb' + ext,
      full: image
    }
  })
}

/**
 * 
 * @param {Map[]} maps
 * @param {string[]} files
 */
function fillImages(maps, files) {
  for (const map of maps) {
    const images = getMapImages(map.name, files)
    if (images.length) {
      map.images = images
    } else {
      console.error(map.name, 'has no images!')
      map.images = [
        {
          thumb: 'placeholder_thumb.avif',
          full: 'placeholder.avif'
        }
      ]
    }
  }
}

async function readMaps() {
  const maps = await getMaps()

  const files = await listMapImageFiles()

  fillImages(maps.featured, files)
  fillImages(maps.collaborations, files)
  fillImages(maps.crap, files)
  
  return maps
}

module.exports = readMaps()
