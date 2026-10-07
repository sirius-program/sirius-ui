# Fields

Read field-props.md for every declared prop/default. Boolean and array props use Blade bindings, e.g. :required="true" and :options="$options". Native HTML attributes pass through where supported; size is sm/md/lg, not HTML's character count. wrapper-class styles the field wrapper; class styles the control.

## Shared field contract

Input, Textarea, Checkbox, Radio, Switch, Currency, Phone, Datetime Picker, Select, File Upload, Richtext and Slider share Field validation/accessibility. Set label/helper and a stable id. Generated IDs are five random characters; provide explicit IDs for repeatable Livewire identity. Error lookup prioritizes error-key, then wire:model property, then name converted from bracket syntax to dots. error-bag defaults default. Helpers/errors are connected with aria-describedby; labels target the control. Disabled controls do not submit; readonly preserves values, blocks editing and uses readonly styling. Server validation remains application-owned.

Field exposes layout=stacked|inline, group, show-required-indicator, show-errors, label-status and wrapper-class. Use group for a set of checkbox/radio inputs, with one group label/error. Custom native controls inside Field use the scoped $component->controlAttributes() attribute bag. Do not invent x-sirius::field.input.

Label has no margin; consumer markup owns spacing. status is right-aligned text or a named status slot. status-id defaults to id or for plus -label-status, otherwise absent.

## Native forms and Livewire

Use x-sirius::form with an explicit action URL. Default method is GET; POST/PUT/PATCH/DELETE add CSRF and method spoofing automatically. sending-file requires a non-GET method and multipart/form-data. Do not duplicate @csrf/@method. File Upload submits native files when inside a multipart Blade form.

Use a native form wire:submit="save" for Livewire. Bind fields with wire:model (or .live when needed) and validate in the application action. Widgets manage hidden canonical bindings; do not bind to their internal display inputs or duplicate initialization. Alpine x-model is supported where the widget contract allows it. Do not apply .number/.boolean/.trim to formatted/string/array widget bindings. Reset model values explicitly; file/phone/richtext reset-key supports intentional resets. Preserve stable wire:key on repeated or conditionally mounted components.

## Canonical values and choice options

- Input/Textarea: native text; input type=password includes a show/hide suffix. prefix/suffix accept text or slots.
- Checkbox/Switch: boolean or native checkbox value; multiple checkboxes bind an array. Radio binds the selected native value. Set explicit values and use a Field group for multiple choices.
- Currency: unformatted decimal string or null, no grouping separators. precision controls display/canonical decimal places; allow-negative defaults false. Explicit separators/precision override sirius-ui.currency configuration. prefix/suffix use shared input styling; control-size forwards HTML's numeric size attribute, while size is the common sm/md/lg field size.
- Datetime Picker: type=date/time/datetime; canonical YYYY-MM-DD, HH:mm, or YYYY-MM-DD HH:mm:ss in the selected timezone. These are local wall-clock values, not UTC/offset ISO strings. display-format changes display only. Explicit locale wins over options.locale and global fallbacks; timezone is an explicit prop with global fallback. Bounds use YYYY-MM-DD for dates, HH:mm for times, and YYYY-MM-DD HH:mm:ss for datetime dates. Clear defaults to !required unless clearable is supplied. Calendar/clock prefix and Clear suffix are built in. Supported Flatpickr options are validated; never pass executable callback strings.
- Phone: country is one country code/regional locale, an array, or "*"; multiple countries use a calling-code Select, wildcard sorted by calling code. delimiter affects display only. Canonical E.164 international string or null; incomplete drafts are not valid canonical numbers. draft-name/draft opt in to native draft restoration; reset-key resets drafts. Optional Sirius\Ui\Rules\PhoneNumber checks syntax and optional calling-code restrictions; it does not replace application rules.
- Select: scalar string ID or array of string IDs in multiple mode. options accepts a flat value=>label map or records with value/label and optional group/disabled. Required selects default clearable=false; otherwise true. Single/multiple choices remain one line; multiple overflow scrolls. For remote choices, search-url accepts a same-origin application GET endpoint; search parameters q/page and initial-resolution values[]; return {"options":[{"value":"id","label":"Name"}],"hasMore":false}. Resolve initial selected IDs, authorize/scope the endpoint, and return only permitted choices. debounce=300 ms and min-search-length=0; max-items only for multiple.
- Slider: number or exactly two numbers when range=true. In range mode min/max/step MUST each be an array of two numbers; scalar mode accepts numeric scalars. Keep server validation consistent with bounds/steps.
- Richtext: HTML string; standalone component, separate from Textarea. toolbar is a list of supported controls, height=240 px by default. There is no locale prop; translate richtext strings. Read RichtextOptions for supported toolbar/options before adding controls.
- File Upload: new native/Livewire temporary files; value contains existing files, not upload bytes. Existing file descriptors require name and size in bytes; url is optional. Single mode allows one descriptor, multiple allows more. Existing files count toward max-files and UI required, but server validation must separately check stored records. Removing one emits file-upload:remove-existing; the application handles the record and storage. Existing files are not re-uploaded or automatically deleted. preview supports image/PDF; a missing URL displays file information only. max-size is KiB.

## Uploads and sanitization

Richtext toolbar commands: bold, italic, underline, strike, heading, bulletList, orderedList, blockquote, codeBlock, link, undo, redo; image is opt-in and requires upload-url. Supported options/defaults: headingLevels=[2,3], undoDepth=100, newGroupDelay=500, autolink=true, linkOnPaste=true. Height accepts 80–2000 px. Do not pass arbitrary Tiptap extension configuration.

File Upload options: allowDrop, allowBrowse, allowPaste and allowReplace are booleans; itemInsertLocation is before|after. Lifecycle/files/server options are package-owned. File Upload accepts one wire:model and no x-model. preview-height accepts 80–1000 px. file-upload:remove-existing bubbles from the native source with the descriptor itself in detail (name/size/url); use a separate trusted stored record ID in application state before deleting anything.

Datetime Picker options: minDate, maxDate, minTime, maxTime, disable, locale, minuteIncrement, hourIncrement, time_24hr, weekNumbers, showMonths, monthSelectorType, position, shorthandCurrentMonth, ariaDateFormat, defaultHour, defaultMinute. minute-increment defaults 5; week-start accepts 0–6. Disabled dates must be a list of valid YYYY-MM-DD strings, never executable predicates. Currency precision accepts 0–20; use decimal strings or integers for value/min/max, never floats. Allowed thousands separators are comma, period, space or apostrophe; decimal separator is period or comma and must differ.

Livewire File Upload uses WithFileUploads in the consuming component. Validate MIME type, size, count and authorization server-side. Accept includes image/jpeg,image/png,application/pdf,text/plain when desired; examples should include images as well as documents.

Richtext image upload: enable image in toolbar and provide upload-url. Sirius POSTs multipart field image; same-origin requests include Laravel CSRF. Return JSON {"url":"https://..."} after authorization and validated storage. upload-max-size defaults 2048 KiB; upload-accept defaults JPEG/PNG/WebP. Use an invocable upload controller and a separate authorized serving endpoint if files are private.

Sanitize submitted HTML with a maintained server-side allowlist before rendering it as HTML. Never trust client HTML or a URL solely because it came from this component. Removing an image/node does not delete permanent storage; the application owns cleanup.

Phone rule example: new Sirius\Ui\Rules\PhoneNumber(['62']) restricts calling-code prefixes. The leading plus belongs to the canonical phone value, not the restriction list. Override phone_number/phone_country in the published validation.php to change messages.
