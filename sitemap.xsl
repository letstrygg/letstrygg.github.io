<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="2.0" 
                xmlns:html="http://www.w3.org/TR/REC-html40"
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
          h1 { color: #0085e3; margin-top: 0; }
          p { color: #aaa; }
          a { color: #e67e22; text-decoration: none; }
          a:hover { text-decoration: underline; }
          
          /* Tree Styles */
          #tree-container {
            margin-top: 20px;
            background-color: #1a1a1a;
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.3);
          }
          details {
            margin-left: 20px;
            padding: 2px 0;
          }
          summary {
            cursor: pointer;
            font-weight: bold;
            color: #fff;
            padding: 4px;
            border-radius: 4px;
            transition: background 0.1s;
          }
          summary:hover { background-color: #333; }
          .file-link {
            display: block;
            margin-left: 24px;
            padding: 4px 0;
            color: #2ecc71;
          }
          .file-link:before {
            content: '📄 ';
            font-size: 12px;
          }
          summary:before {
            content: '📁 ';
            font-size: 12px;
          }
          
          /* Hide the raw table used for data extraction */
          #raw-data { display: none; }
        </style>
      </head>
      <body>
        <div id="content">
          <h1>letstrygg Sitemap</h1>
          <p>
            This is an XML Sitemap, formatted for human readability. It contains <span style="font-weight:bold; color:#2ecc71;"><xsl:value-of select="count(sitemap:urlset/sitemap:url)"/></span> URLs.
          </p>

          <div id="tree-container">
            <em>Building folder structure...</em>
          </div>

          <table id="raw-data">
            <tbody>
              <xsl:for-each select="sitemap:urlset/sitemap:url">
                <tr>
                  <td><xsl:value-of select="sitemap:loc"/></td>
                </tr>
              </xsl:for-each>
            </tbody>
          </table>
        </div>

        <script type="text/javascript">
          <![CDATA[
          document.addEventListener('DOMContentLoaded', function() {
            const rawRows = document.querySelectorAll('#raw-data td');
            const urls = Array.from(rawRows).map(td => td.textContent.trim());
            
            const tree = {};

            // 1. Parse URLs into a nested object
            urls.forEach(url => {
              try {
                const urlObj = new URL(url);
                const parts = urlObj.pathname.split('/').filter(p => p);
                
                let currentLevel = tree;
                parts.forEach((part, index) => {
                  if (!currentLevel[part]) {
                    currentLevel[part] = (index === parts.length - 1) ? url : {};
                  }
                  currentLevel = currentLevel[part];
                });
              } catch(e) {}
            });

            // 2. Recursively build HTML details/summary blocks
            function buildHTML(node) {
              let html = '';
              for (const key in node) {
                if (typeof node[key] === 'string') {
                  // It's a file
                  html += '<a class="file-link" href="' + node[key] + '" target="_blank">' + key + '</a>';
                } else {
                  // It's a folder
                  html += '<details>';
                  html += '<summary>' + key + '</summary>';
                  html += buildHTML(node[key]);
                  html += '</details>';
                }
              }
              return html;
            }

            // 3. Render it
            const container = document.getElementById('tree-container');
            const treeHTML = buildHTML(tree);
            
            // Wrap the whole thing in a root folder (XML safe attributes!)
            container.innerHTML = '<details open="open"><summary>letstrygg.com</summary>' + treeHTML + '</details>';
          });
          ]]>
        </script>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>