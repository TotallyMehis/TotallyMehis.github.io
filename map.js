import { promises as fs } from 'fs'
import sharp from 'sharp'
import path from 'path'

/**
 * @typedef MapsFile
 * @type {object}
 * @property {Map[]} featured
 * @property {Map[]} crap
 * @property {Map[]} collaborations
 * @property {Map[]} ports
 */

/**
 * @typedef Map
 * @type {object}
 * @property {string} name
 * @property {string} year
 * @property {string} [description]
 * @property {MapImage[]} [images]
 */

/**
 * @typedef MapImage
 * @type {object}
 * @property {string} full
 * @property {string} thumb
 */

export async function listMapImageFiles() {
  try {
    const files = await fs.readdir('map_images')
    return files.filter(mapname => mapname.endsWith('.avif'))
  } catch (err) {
    console.error('Failed to read map_images directory!', err)
    throw err
  }
}

export async function getMaps() {
  /** @type {MapsFile} */
  let maps

  try {
    const fileData = await fs.readFile('_maps.json', { encoding: 'utf-8' })
    maps = JSON.parse(fileData.toString())
  } catch (err) {
    console.error('Failed to read maps.json', err)
    throw err
  }

  return maps
}

export async function transformMapImages() {
  console.log('Transforming images to thumbnails...')
  const mapImageFiles = await listMapImageFiles()

  const maps = await getMaps()

  /** @param {string} filename */
  const getThumbnailSize = (filename) => {
    if (maps.featured.some(map => filename.startsWith(map.name + '_'))) {
      return 600
    } else {
      return 400
    }
  }


  await Promise.all(mapImageFiles.map(filename => {
    console.log('Processing', filename)
    const extPos = filename.lastIndexOf('.')
    const filenameNew = filename.substring(0, extPos) + '_thumb' + filename.substring(extPos)
    const outputPath = path.resolve('_site/maps/', filenameNew)
    const thumbnailSize = getThumbnailSize(filename)

    return sharp(path.resolve('map_images', filename)).resize(thumbnailSize).toFile(outputPath)
  }))

  console.log('Transformation done!')
}
