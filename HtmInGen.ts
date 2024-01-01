import { Dictionary } from "./models/Dictionary";

type HtmHTMLElement = {
    originalText: string
} & HTMLElement;

const htmlReplacementRegex = /#{([\w_\-\.]+)}/g;

class EventHandler implements IEventHandler {
    private static instance: EventHandler;
    private eventReceivers: Dictionary<IEventReceiver[]>;

    private constructor() {
        this.eventReceivers = {};
    }

    static getInstance(): IEventHandler {
        return this.instance ?? (this.instance = new EventHandler());
    }

    emit(eventName: string, data: string) {
        this.eventReceivers[eventName].forEach(r => r.onEvent(eventName, data));
    }

    subscribe(eventName: string, receiver: IEventReceiver) {
        if(!this.eventReceivers[eventName]) {
            this.eventReceivers[eventName] = [];
        }

        this.eventReceivers[eventName].push(receiver);
    }
}

export interface IEventHandler {
    subscribe(eventName: string, receiver: IEventReceiver): void;

    emit(eventName: string, data: string): void;
}

export interface IEventReceiver {
    onEvent(eventName: string, data: string): void;
}

export abstract class BaseView {
    public element!: HTMLElement;
    public dataReferrals: Dictionary<HtmHTMLElement[]>;

    constructor() {
        this.dataReferrals = {};
    }

    public abstract onUpdate(): Promise<void>;

    public abstract onLoad(): Promise<void>;

    public async getHtml(): Promise<string> {
        return await (await fetch(chrome.runtime.getURL(`views/${this.constructor.name}.htm`))).text();
    }
}

interface IBaseViewConstructor {
    new (...args: any[]): BaseView;

    // Or enforce default constructor
    // new (): T;
}

export class HtmInGen {
    private readonly controllers: Dictionary<IBaseViewConstructor>;
    
    constructor(...controllers: IBaseViewConstructor[]) {
        this.controllers = {};

        controllers.forEach(c => this.controllers[c.name] = c);
    }

    static subscribe(eventName: string, receiver: IEventReceiver) {
        EventHandler.getInstance().subscribe(eventName, receiver);
    }

    static emit(eventName: string, data: string) {
        EventHandler.getInstance().emit(eventName, data);
    }

    async attach(rootView: BaseView, anchorElement: HTMLElement | ((e: HTMLElement) => void)) {
        let element: HTMLElement = document.createElement('div');
        element.innerHTML = await rootView.getHtml();
        element = element.firstElementChild as HTMLElement;

        rootView.element = element;

        this.traverse(rootView.element, rootView);
        
        if (anchorElement instanceof HTMLElement) {
            anchorElement.appendChild(rootView.element as Node);
        } else {
            anchorElement(rootView.element);
        }

        rootView.onLoad();
    }

    private async traverse(e: HTMLElement, view: BaseView) {
        // Go through each HTML DOM Element and register any events, create any new view controllers, etc.
        for (let index = 0; index < e.childNodes.length; index++) {
            const child = e.childNodes[index] as HtmHTMLElement;

            if (child.nodeType === child.TEXT_NODE) {
                this.replaceHtmlContent(child, view, true);
            }

            if (child.nodeType === child.ELEMENT_NODE) {
                // register click events
                if(child.hasAttribute('hig-click')) {                    
                    child.onclick = (view as any)[child.getAttribute('hig-click')!];
                }

                // create the Controller
                if (child.hasAttribute('hig-view')) {
                    const dataValue = this.getDataAttributeValue(child, view);
                    let newClass: BaseView;
                    if (dataValue == null) {
                        newClass = new this.controllers[child.getAttribute('hig-view')!]();
                    } else {
                        newClass = new this.controllers[child.getAttribute('hig-view')!](dataValue);
                    }

                    newClass.element = child;
                    newClass.element.innerHTML = await newClass.getHtml();
                    await this.traverse(newClass.element, newClass);
                    newClass?.onLoad();
                } else {
                    await this.traverse(child, view);
                }
            }
        }

        return e;
    }

    private getDataAttributeValue(element: Element, controller: BaseView): any | null {
        let dataToPass: any = null;

        if (element.hasAttribute('hig-data')) {
            dataToPass = element.getAttribute('hig-data')!;
            
            const m = [...dataToPass.matchAll(htmlReplacementRegex)];
            if(m) {
                dataToPass = (controller as any)[m[0][1]];
            }
        }

        return dataToPass;
    }

    private replaceHtmlContent(child: HtmHTMLElement, clazz: BaseView, settingUp: boolean = false) {
        if (child.textContent == null) {
            return;
        }

        if (settingUp) {
            child.originalText = child.textContent;
        }

        const matches = [...child.originalText.matchAll(htmlReplacementRegex)];

        matches.forEach(([toReplace, property]) => {
            
            // This is for situations like: data.foo.bar.fuzz
            const subProperties = property.split('.');
            let value: any = clazz;
            for (let index = 0; index < subProperties.length; index++) {
                value = value[subProperties[index]];

                if (!value) {
                    break;
                }
            }

            child.textContent = child.originalText!.replace(toReplace, typeof value == 'object' ? encodeURIComponent(JSON.stringify(value)) : value);

            if (settingUp) {
                if(!clazz.dataReferrals[subProperties[0]]) {
                    clazz.dataReferrals[subProperties[0]] = [child];
                } else {
                    clazz.dataReferrals[subProperties[0]].push(child);
                }

                this.defineSetAndGet(clazz, subProperties[0]);
            }
            
        });
    }

    private defineSetAndGet(clazz: BaseView, property: string): void {
        const htmInGen: HtmInGen = this;
        (clazz as any)[`_${property}`] = (clazz as any)[property];

        try {
            Object.defineProperty(clazz, property, {
                get() {
                    return this['_'+property];
                },
                set(v) {
                    this['_'+property] = v;
    
                    (this as BaseView).dataReferrals[property].forEach(ref => htmInGen.replaceHtmlContent(ref, this));
                },
            });
        } catch (error) {
            console.warn('property already defined.', property, error);
        }
    }
}
