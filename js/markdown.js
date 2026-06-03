// Markdown — lightweight markdown-to-HTML converter (no dependencies)
var Markdown = (function () {

  function render(src) {
    if (!src) return '';
    var html = src.replace(/\r\n/g, '\n');

    // Extract code blocks into placeholders FIRST so subsequent regexes don't touch their content
    var blocks = [];
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, function (_, lang, code) {
      var escaped = _escapeHtml(code.replace(/\n$/, ''));
      var cls = lang ? ' class="language-' + lang + '"' : '';
      var rendered = '<pre><code' + cls + '>' + _highlightCode(escaped, lang) + '</code></pre>';
      blocks.push(rendered);
      return '\x02BLOCK' + (blocks.length - 1) + '\x03';
    });

    // Blockquotes
    html = html.replace(/^(>{1,})\s?(.+)$/gm, function (_, level, text) {
      return '<blockquote>' + text + '</blockquote>';
    });
    // Merge adjacent blockquotes
    html = html.replace(/<\/blockquote>\n<blockquote>/g, '\n');

    // Tables
    html = html.replace(/^(\|.+\|)\n(\|[-:| ]+\|)\n((?:\|.+\|\n?)*)/gm, function (_, headerRow, sepRow, bodyRows) {
      var headers = _parseTableRow(headerRow);
      var aligns = _parseAligns(sepRow);
      var rows = bodyRows.trim().split('\n').map(_parseTableRow);

      var thead = '<thead><tr>' + headers.map(function (h, i) {
        var align = aligns[i] ? ' style="text-align:' + aligns[i] + '"' : '';
        return '<th' + align + '>' + _inline(h) + '</th>';
      }).join('') + '</tr></thead>';

      var tbody = '<tbody>' + rows.map(function (row) {
        return '<tr>' + row.map(function (cell, i) {
          var align = aligns[i] ? ' style="text-align:' + aligns[i] + '"' : '';
          return '<td' + align + '>' + _inline(cell) + '</td>';
        }).join('') + '</tr>';
      }).join('') + '</tbody>';

      return '<table>' + thead + tbody + '</table>';
    });

    // Headings
    html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

    // Horizontal rule
    html = html.replace(/^---+$/gm, '<hr>');

    // Unordered lists
    html = html.replace(/^(?:[-*+] .+\n?)+/gm, function (block) {
      var items = block.trim().split('\n').map(function (line) {
        return '<li>' + _inline(line.replace(/^[-*+]\s/, '')) + '</li>';
      });
      return '<ul>' + items.join('') + '</ul>';
    });

    // Ordered lists
    html = html.replace(/^(?:\d+\. .+\n?)+/gm, function (block) {
      var items = block.trim().split('\n').map(function (line) {
        return '<li>' + _inline(line.replace(/^\d+\.\s/, '')) + '</li>';
      });
      return '<ol>' + items.join('') + '</ol>';
    });

    // Paragraphs: wrap remaining standalone lines
    html = html.replace(/^(?!<[a-z/])((?!^\s*$).+)$/gm, function (_, line) {
      return '<p>' + _inline(line) + '</p>';
    });

    // Clean up extra blank lines
    html = html.replace(/\n{3,}/g, '\n\n');

    // Restore code blocks (must be last so no other transform runs on their content)
    html = html.replace(/\x02BLOCK(\d+)\x03/g, function (_, i) {
      return blocks[parseInt(i)];
    });

    return html;
  }

  // Inline formatting
  function _inline(text) {
    // Inline code (before other formatting to avoid conflicts)
    text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
    // Bold + italic
    text = text.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    // Bold
    text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // Italic
    text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');
    // Links
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
    return text;
  }

  function _escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function _parseTableRow(row) {
    return row.replace(/^\||\|$/g, '').split('|').map(function (c) { return c.trim(); });
  }

  function _parseAligns(sepRow) {
    return _parseTableRow(sepRow).map(function (col) {
      if (col.match(/^:-+:$/)) return 'center';
      if (col.match(/-+:$/)) return 'right';
      return 'left';
    });
  }

  // Basic syntax highlighting for YAML and shell commands
  function _highlightCode(code, lang) {
    if (lang === 'yaml' || lang === 'yml') {
      code = code.replace(/(#.*)$/gm, '<span style="color:#6a9955">$1</span>');
      code = code.replace(/^(\s*)([\w.-]+)(:)/gm, '$1<span style="color:#9cdcfe">$2</span><span style="color:#d4d4d4">$3</span>');
      code = code.replace(/:\s*(&quot;.*?&quot;|&#39;.*?&#39;)/g, ': <span style="color:#ce9178">$1</span>');
      code = code.replace(/:\s*(true|false|null|yes|no)(\s|$)/gi, ': <span style="color:#569cd6">$1</span>$2');
      code = code.replace(/:\s*(\d+)(\s|$)/g, ': <span style="color:#b5cea8">$1</span>$2');
    } else if (lang === 'bash' || lang === 'sh' || lang === 'shell') {
      code = code.replace(/(#.*)$/gm, '<span style="color:#6a9955">$1</span>');
      code = code.replace(/^(\$\s*)(kubectl|docker|kubeadm|etcdctl|crictl)(\s)/gm,
        '$1<span style="color:#569cd6">$2</span>$3');
    }
    return code;
  }

  return { render: render };
})();
