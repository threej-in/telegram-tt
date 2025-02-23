# Contest

1. Text editor
    - Fixed edit history by using document.execCommand() to modify the content editable div which ensures browser history is updated when changes are made.
    - Fixed text formatter by using tree walker to consistently find the applied formatting to the selected text.
    - Added support for adding and editing quotes
    - Switched markdown parser from regex to AST based parser

2. Chat Folders
    - Tried to implement identically similar vertical folders tab as in mockup
    - Provided an option to change the location of folder tab in settings
    - Added a custom emoji picker in folder settings
    - User can pick custom emoji as folder icon which will be stored in the folder title as entities and will be rendered as icon when received from server
    - Added support for RTL languages

3. Custom Background
    - Added support for custom background using WebGL from the reference github repo which was provided in task description
    - Configured WebGL support detection and fallback
    - Option to toggle pattern and pick gradient color using controls provided in settings

4. Others
    - Improved UI of left column header, tried to match with windows desktop client UI
    - Implemented search feature in custom emoji picker, however search algorithm still need improvement
    - Added support for selecting multiple message with mousing dragging