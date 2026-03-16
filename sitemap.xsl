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
          
          table {
            border-collapse: collapse; 
            width: 100%; 
            margin-top: 20px;
            background-color: #1a1a1a; 
            border-radius: 8px; 
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0,0,0,0.3);
          }
          th { background-color: #333; color: #fff; text-align: left; padding: 12px 15px; }
          td { padding: 10px 15px; border-bottom: 1px solid #333; }
          tr:nth-child(even) td { background-color: #222; }
          
          details { padding: 10px 15px; background-color: #1f1f1f; border-bottom: 1px solid #333; }
          summary { cursor: pointer; font-weight: bold; color: #0085e3; padding: 5px; outline: none; }
          summary:hover { background-color: #2a2a2a; border-radius: 4px; }
          
          .inner-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          .inner-table td { border-bottom: 1px solid #2a2a2a; padding: 8px 10px; font-size: 13px; }
          .inner-table tr:nth-child(even) td { background-color: transparent; }
        </style>
      </head>
      <body>
        <div>
          <h1>letstrygg Sitemap</h1>
          <p>
            This is an XML Sitemap, formatted for human readability. It contains <span style="font-weight:bold; color:#2ecc71;"><xsl:value-of select="count(sitemap:urlset/sitemap:url)"/></span> URLs.
          </p>
          <table id="sitemap-table" cellpadding="3">
            <thead>
              <tr>
                <th width="80%">URL</th>
                <th width="20%">Last Modified</th>
              </tr>
            </thead>
            <tbody>
              <xsl:for-each select="sitemap:urlset/sitemap:url">
                <xsl:sort select="sitemap:loc" data-type="text" order="ascending"/>
                <tr>
                  <td><a href="{sitemap:loc}" target="_blank"><xsl:value-of select="sitemap:loc"/></a></td>
                  <td><xsl:value-of select="substring(sitemap:lastmod,1,10)"/></td>
                </tr>
              </xsl:for-each>
            </tbody>
          </table>
        </div>

        <script type="text/javascript">
          /* <![CDATA[ */
          setTimeout(function() {
            var tbody = document.querySelector("#sitemap-table tbody");
            if (!tbody) return;
            
            var rows = Array.from(tbody.querySelectorAll("tr"));
            var groups = {};
            var standaloneRows = [];

            // 1. Sort rows into game folders or leave them alone
            rows.forEach(function(row) {
              var a = row.querySelector("a");
              if (!a) return;
              var url = a.getAttribute("href");
              
              var parts = url.split("/game/");
              if (parts.length > 1) {
                var gameName = parts[1].split("/")[0]; // Grabs '20-minutes-till-dawn'
                if (gameName) {
                  if (!groups[gameName]) groups[gameName] = [];
                  groups[gameName].push(row);
                  return;
                }
              }
              // If it's not a specific game page, keep it as a standalone row
              standaloneRows.push(row);
            });

            // 2. Clear the table and rebuild it
            tbody.innerHTML = "";

            // Put standalone rows (like the root / or /game/) back first
            standaloneRows.forEach(function(row) {
              tbody.appendChild(row);
            });

            // Build the collapsible folders for each game
            for (var game in groups) {
              var tr = document.createElement("tr");
              var td = document.createElement("td");
              td.colSpan = 2;
              td.style.padding = "0";

              var details = document.createElement("details");
              var summary = document.createElement("summary");
              summary.textContent = "📁 " + game + " (" + groups[game].length + " pages)";
              
              var innerTable = document.createElement("table");
              innerTable.className = "inner-table";
              
              groups[game].forEach(function(row) {
                innerTable.appendChild(row);
              });

              details.appendChild(summary);
              details.appendChild(innerTable);
              td.appendChild(details);
              tr.appendChild(td);
              tbody.appendChild(tr);
            }
          }, 50);
          /* ]]> */
        </script>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>