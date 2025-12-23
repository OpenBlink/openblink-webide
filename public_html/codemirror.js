const defaultRubyCode = `# RGB LED Blinking Example
while true do
  # Red
  LED.set([255, 0, 0])
  sleep 1

  # Green
  LED.set([0, 255, 0])
  sleep 1

  # Blue
  LED.set([0, 0, 255])
  sleep 1
end
`;

var editor = CodeMirror.fromTextArea(document.getElementById("ruby-code"), {
  mode: "ruby",
  theme: "dracula",
  lineNumbers: true,
  matchBrackets: true,
  autoCloseBrackets: true,
});

editor.getDoc().setValue(defaultRubyCode);
