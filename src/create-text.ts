import { AppBase, Entity, CanvasFont, Color, ELEMENTTYPE_TEXT } from "playcanvas";

export function createText(app: AppBase, text: string, x: number, y: number, w: number, h: number, textColor: Color, fontSize: number, fontName: string = "Arial"): Entity {
    const canvasFont = new CanvasFont(app, {
        color: textColor,
        fontName: fontName,
        fontSize: fontSize,
        width: w,
        height: h
    });
    // The first texture update needs to be `createTextures()`. Follow-up calls need to be `updateTextures()`.
    // NOTE: Unsure if above comment is actually true, seems to error so just keep using createTextures()
    canvasFont.createTextures(text);
    
    const canvasElementEntity = new Entity("ButtonText");
    canvasElementEntity.setLocalPosition(x, y, 0);
    canvasElementEntity.addComponent('element', {
        pivot: [0.5, 0.5],
        anchor: [0.5, 0.5, 0.5, 0.5],
        fontSize: fontSize,
        text: text,
        type: ELEMENTTYPE_TEXT
    });
    canvasElementEntity.element.font = canvasFont;

    return canvasElementEntity;
}