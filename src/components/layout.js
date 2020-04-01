import React from "react"
import { Link, graphql, useStaticQuery } from "gatsby"
import Image from "gatsby-image"

import { rhythm, scale } from "../utils/typography"

const Layout = ({ location, title, children }) => {
  const data = useStaticQuery(graphql`
    query SocialIcons {
      github: file(absolutePath: { regex: "/github.png/" }) {
        childImageSharp {
          fixed(width: 32, height: 32) {
            ...GatsbyImageSharpFixed
          }
        }
      }
      twitter: file(absolutePath: { regex: "/twitter.png/" }) {
        childImageSharp {
          fixed(width: 32, height: 32) {
            ...GatsbyImageSharpFixed
          }
        }
      }
    }
  `)
  const rootPath = `${__PATH_PREFIX__}/`

  const socialButtons = (
    <div
      style={{
        display: `flex`,
        flex: `0 1 auto`,
        alignSelf: `center`,
      }}
    >
      <a style={{ display: `flex` }} href="https://github.com/nbrendler">
        <Image fixed={data.github.childImageSharp.fixed} />
      </a>
      <a style={{ display: `flex` }} href="https://twitter.com/NikBrendler">
        <Image
          style={{
            marginLeft: rhythm(1 / 5),
          }}
          fixed={data.twitter.childImageSharp.fixed}
        />
      </a>
    </div>
  )
  let header
  let listItem = (path, name, root) => (
    <li style={{ float: `left`, marginBottom: 0 }}>
      <Link
        style={{
          ...scale(-0.25),
          display: `block`,
          textAlign: `center`,
          textDecoration: `underline`,
          paddingLeft: root ? `0` : rhythm(0.5),
          paddingRight: root ? rhythm(0.5) : `0`,
          color: `#000`,
        }}
        to={path}
      >
        {name}
      </Link>
    </li>
  )

  if (location.pathname === rootPath) {
    header = (
      <div style={{ display: `flex`, flexWrap: `wrap` }}>
        <h1
          style={{
            ...scale(1.2),
            marginBottom: 0,
            marginTop: 0,
            flex: `1 1 auto`,
          }}
        >
          <Link
            style={{
              boxShadow: `none`,
              textDecoration: `none`,
              color: `inherit`,
            }}
            to={`/`}
          >
            {title}
          </Link>
        </h1>
        {socialButtons}
        <ul
          style={{
            flex: `1 1 100%`,
            overflow: `hidden`,
            listStyleType: `none`,
            marginLeft: 0,
            marginBottom: rhythm(1.5),
          }}
        >
          {listItem("/projects", "projects", true)}
          {listItem("/now", "now", true)}
        </ul>
      </div>
    )
  } else {
    header = (
      <div style={{ display: `flex` }}>
        <h3
          style={{
            fontFamily: `sans-serif`,
            marginTop: 0,
            marginBottom: 0,
            float: `left`,
          }}
        >
          <Link
            style={{
              boxShadow: `none`,
              textDecoration: `none`,
              color: `inherit`,
            }}
            to={`/`}
          >
            {title}
          </Link>
        </h3>
        <ul
          style={{
            flex: `1 1 auto`,
            overflow: `hidden`,
            listStyleType: `none`,
            marginLeft: 0,
            marginBottom: 0,
          }}
        >
          {listItem("/projects", "projects")}
          {listItem("/now", "now")}
        </ul>
        {socialButtons}
      </div>
    )
  }
  return (
    <div
      style={{
        marginLeft: `auto`,
        marginRight: `auto`,
        maxWidth: rhythm(32),
        padding: `${rhythm(1.5)} ${rhythm(3 / 4)}`,
      }}
    >
      <header>{header}</header>
      <main>{children}</main>
      <footer>
        © {new Date().getFullYear()}, Built with
        {` `}
        <a href="https://www.gatsbyjs.org">Gatsby</a>
      </footer>
    </div>
  )
}

export default Layout
