<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="2.0" 
                xmlns:html="http://www.w3.org/TR/REC-html40"
                xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"
                xmlns:sitemap="http://www.sitemaps.org/schemas/sitemap/0.9"
                xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:output method="html" version="1.0" encoding="UTF-8" indent="yes"/>
  <xsl:template match="/">
    <html xmlns="http://www.w3.org/1999/xhtml">
      <head>
        <title>XML Sitemap | letstrygg</title>
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
        <style type="text/css">
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            font-size: 14px;
            color: #ccc;
            background-color: #121212;
            margin: 0;
            padding: 40px;
          }
          h1 {
            color: #0085e3;
            margin-top: 0;
          }
          p {
            color: #aaa;
          }
          a {
            color: #e67e22;
            text-decoration: none;
          }
          a:hover {
            text-decoration: underline;
          }
          table {
            border: none;
            border-collapse: collapse;
            width: 100%;
            margin-top: 20px;
            background-color: #1a1a1a;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0,0,0,0.3);
          }
          th {
            background-color: #333;
            color: #fff;
            text-align: left;
            padding: 12px 15px;
            font-size: 13px;
          }
          tr:nth-child(even) {
            background-color: #222;
          }
          td {
            padding: 10px 15px;
            border-bottom: 1px solid #333;
          }
          .count {
            font-weight: bold;
            color: #2ecc71;
          }
        </style>
      </head>
      <body>
        <div id="content">
          <h1>letstrygg Sitemap</h1>
          <p>
            This is an XML Sitemap, formatted for human readability. It contains <span class="count"><xsl:value-of select="count(sitemap:urlset/sitemap:url)"/></span> URLs.
          </p>
          <table cellpadding="3">
            <thead>
              <tr>
                <th width="75%">URL</th>
                <th width="25%">Last Modified</th>
              </tr>
            </thead>
            <tbody>
              <xsl:variable name="lower" select="'abcdefghijklmnopqrstuvwxyz'"/>
              <xsl:variable name="upper" select="'ABCDEFGHIJKLMNOPQRSTUVWXYZ'"/>
              <xsl:for-each select="sitemap:urlset/sitemap:url">
                <tr>
                  <td>
                    <xsl:variable name="itemURL">
                      <xsl:value-of select="sitemap:loc"/>
                    </xsl:variable>
                    <a href="{$itemURL}">
                      <xsl:value-of select="sitemap:loc"/>
                    </a>
                  </td>
                  <td>
                    <xsl:value-of select="concat(substring(sitemap:lastmod,0,11),concat(' ', substring(sitemap:lastmod,12,5)),concat(' ', substring(sitemap:lastmod,20,6)))"/>
                  </td>
                </tr>
              </xsl:for-each>
            </tbody>
          </table>
        </div>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>