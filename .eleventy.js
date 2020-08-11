const syntaxHighlighting = require("@11ty/eleventy-plugin-syntaxhighlight")

module.exports = function (eleventyConfig) {
  eleventyConfig.addPlugin(syntaxHighlighting)
  eleventyConfig.setDataDeepMerge(true)
  eleventyConfig.addFilter("isoDate", isoDate)
  eleventyConfig.addCollection("postsByMonth", (collectionsApi) =>
    collectionsApi
      .getFilteredByGlob("posts/**/*.md")
      .reduce(function (arr, post) {
        var postKey = readableMonth(post.data.date)
        var prevKey = arr.length && arr[arr.length - 1].key

        if (prevKey === postKey) {
          arr[arr.length - 1].posts.push(post)
        } else {
          arr.push({ key: postKey, posts: [post] })
        }

        return arr
      }, [])
  )
  eleventyConfig.addPassthroughCopy("img")
  eleventyConfig.addPassthroughCopy("css")
  eleventyConfig.addPassthroughCopy("favicon.ico")
  return eleventyConfig
}
const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

const readableMonth = (d) => `${months[d.getMonth()]} ${d.getFullYear()}`

const isoDate = (d) => d.toISOString().slice(0, 10)
