import { LitElement, html, nothing } from 'da-lit';
import { getNx } from '../../scripts/utils.js';
import { debouncedSaveSheets } from './utils/utils.js';

const { default: getStyle } = await import(`${getNx()}/utils/styles.js`);
const { default: getSvg } = await import(`${getNx()}/utils/svg.js`);

const style = await getStyle(import.meta.url);

const SHEET_TEMPLATE = { minDimensions: [20, 20], sheetName: 'data' };
const ICONS = [
  '/blocks/edit/img/Smock_Delete_18_N.svg',
  '/blocks/edit/img/Smock_Edit_18_N.svg',
  '/blocks/edit/img/Smock_Cancel_18_N.svg',
  '/blocks/edit/img/Smock_Checkmark_18_N.svg',
];

const setCustomValidity = (inputEl, msg = '') => {
  inputEl.setCustomValidity(msg);
  inputEl.reportValidity();
};

class DaSheetTabs extends LitElement {
  static properties = {
    _permissions: { attribute: false },
    _names: { attribute: false },
    _active: { attribute: false },
    _edit: { attribute: false },
  };

  connectedCallback() {
    super.connectedCallback();
    this.shadowRoot.adoptedStyleSheets = [style];
    getSvg({ parent: this.shadowRoot, paths: ICONS });
    this._names = this.getNames();
    this.showSheet(0);
    this.getPermissions();
  }

  getPermissions() {
    this.permissions = document.querySelector('da-title').permissions;
  }

  showSheet(idx) {
    this._active = idx;
    this.sheetContents.forEach((sheet) => { sheet.style.display = 'none'; });
    this.sheetContents[idx].style.display = 'block';
  }

  getNames() {
    return this.jexcel.map((sheet) => sheet.name);
  }

  get tabContainer() {
    return this.parentElement.querySelector('.jexcel_tabs');
  }

  get jexcel() {
    return this.tabContainer.jexcel;
  }

  get hiddenTabs() {
    const parent = this.tabContainer.querySelector(':scope > div:first-child');
    return parent.querySelectorAll('.jexcel_tab_link');
  }

  get sheetContents() {
    const parent = this.tabContainer.querySelector(':scope > div:last-child');
    return parent.querySelectorAll('.jexcel_container');
  }

  get _canWrite() {
    return this.permissions.some((permission) => permission === 'write');
  }

  handleAdd() {
    const sheets = [{
      ...SHEET_TEMPLATE,
      sheetName: `data-${this.jexcel.length + 1}`,
    }];
    // Add the new tab
    window.jspreadsheet.tabs(this.tabContainer, sheets);
    const newSheet = this.jexcel.slice(-1)[0];
    newSheet.name = sheets[0].sheetName;
    newSheet.options.onbeforepaste = (_el, pasteVal) => pasteVal?.trim();
    if (this.tabContainer.details.view !== 'config') {
      newSheet.options.onafterchanges = () => {
        debouncedSaveSheets(this.jexcel);
      };
    }

    // Refresh the tab names
    this._names = this.getNames();
    // Only set active as jspreadsheet will set the visibility of the sheet
    this._active = this.jexcel.length - 1;
    // Set the tab to be in edit mode
    this._edit = this.jexcel.length - 1;
  }

  handleEdit(e, idx) {
    e.preventDefault();
    if (e.submitter.value === 'select') {
      this.showSheet(idx);
      return;
    }
    if (e.submitter.value === 'edit') {
      this._edit = idx;
      return;
    }
    if (e.submitter.value === 'cancel') {
      const inputEl = e.target.querySelector('input');
      setCustomValidity(inputEl, '');
      this._edit = null;
      return;
    }
    if (e.submitter.value === 'remove') {
      this._names.splice(idx, 1);
      this.jexcel.splice(idx, 1);
      this.hiddenTabs[idx].remove();
      this.sheetContents[idx].remove();
      this._edit = null;
      this.showSheet(0);
      return;
    }
    if (e.submitter.value === 'confirm') {
      const name = Object.fromEntries(new FormData(e.target))?.name;
      const inputEl = e.target.querySelector('input');
      const cancelEl = e.target.querySelector('button[aria-label="Cancel"]');

      const sheetNames = this.getNames();
      sheetNames.splice(idx, 1); // remove current sheet

      if (sheetNames.includes(name)) {
        setCustomValidity(inputEl, 'Sheet name already exists');

        inputEl.addEventListener('input', () => {
          setCustomValidity(inputEl, '');
        }, { once: true });

        cancelEl.addEventListener('click', () => {
          setCustomValidity(inputEl, '');
          this._edit = null;
        }, { once: true });

        return;
      }

      this._names[idx] = name;
      this.jexcel[idx].name = name;
      this.hiddenTabs[idx].innerHTML = name;
      this._edit = null;
    }
  }

  render() {
    if (!this._names || !this.permissions) return nothing;

    return html`
      <ul>
        ${this._names.map((name, idx) => html`
          <li class="${idx === this._active ? 'active' : ''} ${this._canWrite ? '' : 'is-read-only'}" @click=${() => this.showSheet(idx)}>
            <form @submit=${(e) => this.handleEdit(e, idx)}>
              ${idx === this._edit ? html`
                <input type="text" name="name" value="${name}" />
              ` : html`
                <button value="select"><span>${name}</span></button>
              `}
              ${idx === this._edit ? html`
                <div class="action-container">
                  <button aria-label="Confirm" value="confirm">
                    <svg class="icon"><use href="#spectrum-Checkmark"/></svg>
                  </button>
                  <button aria-label="Cancel" value="cancel">
                    <svg class="icon"><use href="#spectrum-Cancel"/></svg>
                  </button>
                  <button aria-label="Remove" value="remove">
                    <svg class="icon"><use href="#spectrum-Delete"/></svg>
                  </button>
                </div>
              ` : html`
                <button class="da-sheet-edit-button" aria-label="Edit" value="edit">
                  <svg class="icon"><use href="#spectrum-Edit"/></svg>
                </button>
              `}
            </form>
          </li>`)}
      </ul>
      <button class="add-sheet ${this._canWrite ? '' : 'is-read-only'}" @click=${this.handleAdd}>Add sheet</button>
    `;
  }
}

customElements.define('da-sheet-tabs', DaSheetTabs);
