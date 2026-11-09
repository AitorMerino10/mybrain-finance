export const SPLASH_TITLE = 'MyBrain'
export const SPLASH_SLOGAN = 'Tus finanzas, en familia'

/** iPhones (pantalla en puntos y densidad). iOS enseña la imagen de arranque que coincide con el dispositivo. */
export const IPHONE_SCREENS = [
  { w: 440, h: 956, r: 3 }, // 16 Pro Max
  { w: 402, h: 874, r: 3 }, // 16 Pro
  { w: 430, h: 932, r: 3 }, // 16 Plus, 15 Plus / Pro Max, 14 Pro Max
  { w: 393, h: 852, r: 3 }, // 16, 15, 15 Pro, 14 Pro
  { w: 428, h: 926, r: 3 }, // 14 Plus, 13 Pro Max, 12 Pro Max
  { w: 390, h: 844, r: 3 }, // 14, 13, 13 Pro, 12, 12 Pro
  { w: 375, h: 812, r: 3 }, // 13 mini, 12 mini, 11 Pro, XS, X
  { w: 414, h: 896, r: 3 }, // 11 Pro Max, XS Max
  { w: 414, h: 896, r: 2 }, // 11, XR
  { w: 414, h: 736, r: 3 }, // 8 Plus, 7 Plus
  { w: 375, h: 667, r: 2 }, // 8, 7, SE (2.ª y 3.ª gen.)
  { w: 320, h: 568, r: 2 }, // SE (1.ª gen.)
]

export const splashSizes = IPHONE_SCREENS.map(({ w, h, r }) => `${w * r}x${h * r}`)

export const splashStartupImages = IPHONE_SCREENS.map(({ w, h, r }) => ({
  url: `/app-splash/${w * r}x${h * r}`,
  media: `(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${r}) and (orientation: portrait)`,
}))
