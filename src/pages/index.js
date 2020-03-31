import React from "react"
import { Link, graphql } from "gatsby"

import Layout from "../components/layout"
import SEO from "../components/seo"
import { rhythm } from "../utils/typography"

import "../../static/style.css"

class BlogIndex extends React.Component {
  render() {
    const { data } = this.props
    const siteTitle = data.site.siteMetadata.title
    const posts = groupByMonth(data.allMarkdownRemark.edges)

    return (
      <Layout location={this.props.location} title={siteTitle}>
        <SEO title={`Blog`} />
        {posts.map(({ key, entries }) => {
          return (
            <section style={{ marginBottom: rhythm(1 / 1.5) }}>
              <header>
                <h3
                  style={{
                    marginBottom: 0,
                    borderBottom: `1px solid rgba(0, 0, 0, 0.3)`,
                  }}
                >
                  {key}
                </h3>
              </header>
              {entries.map(({ node }) => {
                const title = node.frontmatter.title || node.fields.slug
                return (
                  <article
                    style={{ marginBottom: rhythm(1 / 3) }}
                    key={node.fields.slug}
                  >
                    <header
                      className="blog-title"
                      style={{
                        display: `flex`,
                      }}
                    >
                      <h5
                        style={{
                          marginBottom: 0,
                          flex: `1 1 auto`,
                        }}
                      >
                        <Link
                          style={{
                            boxShadow: `none`,
                            textDecoration: `none`,
                            color: `rgba(0, 0, 0, 0.8)`,
                          }}
                          to={node.fields.slug}
                        >
                          {title}
                        </Link>
                      </h5>
                      <small style={{ flex: `0 1 auto`, alignSelf: `center` }}>
                        {node.frontmatter.date}
                      </small>
                    </header>
                    <section>
                      <small
                        dangerouslySetInnerHTML={{
                          __html: node.frontmatter.description || node.excerpt,
                        }}
                      />
                    </section>
                  </article>
                )
              })}
            </section>
          )
        })}
      </Layout>
    )
  }
}

export default BlogIndex

export const pageQuery = graphql`
  query {
    site {
      siteMetadata {
        title
      }
    }
    allMarkdownRemark(
      sort: { fields: [frontmatter___date], order: DESC }
      limit: 1000
      filter: { frontmatter: { tags: { nin: "standalone" } } }
    ) {
      edges {
        node {
          excerpt
          fields {
            slug
          }
          frontmatter {
            date(formatString: "MMMM DD, YYYY")
            title
            description
          }
        }
      }
    }
  }
`

// in theory the graphql query could do this for me but the sorting seems tricky
const groupByMonth = posts =>
  posts.reduce((group, post, idx) => {
    let postMonth = quickFormat(new Date(post.node.frontmatter.date))
    let monthEntry = group.findIndex(g => g.key === postMonth)

    if (monthEntry > -1) {
      group[monthEntry].entries.push(post)
    } else {
      group.push({
        key: postMonth,
        entries: [post],
      })
    }
    return group
  }, [])

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

const quickFormat = d => `${months[d.getMonth()]} ${d.getFullYear()}`
