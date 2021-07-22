/* @flow */
// 直接判断window是否存在，来确定是否在浏览器环境中
export const inBrowser = typeof window !== 'undefined'
