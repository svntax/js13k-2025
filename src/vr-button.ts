import { AppBase, Entity, Color,
    Vec3,
    ELEMENTTYPE_IMAGE,
} from 'playcanvas';
import { createText } from './create-text';

interface VRButtonProperties {
    position?: Vec3;
    text?: string;
    width?: number;
    height?: number;
    fontSize?: number;
    textColor?: Color;
    backgroundColor?: Color;
    hoverTint?: Color;
    pressedTint?: Color;
    inactiveTint?: Color;
    clickCallback?: () => void;
}

export class VRButton {
    entity: Entity;

    constructor(app: AppBase, props: VRButtonProperties = {}) {
        const {
            position = new Vec3(0,0,0),
            text = 'Button',
            width = 354,
            height = 100,
            fontSize = 32,
            textColor = Color.BLACK,
            backgroundColor = Color.WHITE,
            hoverTint = new Color(0, 0.5019607843137255, 1, 1),
            pressedTint = new Color(0.5019607843137255, 1, 0.5019607843137255, 1),
            inactiveTint = new Color(1, 1, 1, 0.5019607843137255),
            clickCallback = () => {}
        } = props;

        // Create main button entity
        this.entity = new Entity('Button');
        this.entity.setLocalPosition(position);

        // Button
        const button = new Entity();
        button.setLocalPosition(position);
        button.addComponent('button', {
            active: true,
            transitionMode: 0,
            hoverTint: hoverTint,
            pressedTint: pressedTint,
            inactiveTint: inactiveTint,
            fadeDuration: 0
        });
        button.addComponent('element', {
            anchor: [0.5, 0.5, 0.5, 0.5],
            width: width,
            height: height,
            pivot: [0.5, 0.5],
            type: ELEMENTTYPE_IMAGE,
            useInput: true,
            color: backgroundColor
        });
        this.entity.addChild(button);

        const textEntity = createText(app, text, position.x, position.y, width, height, textColor, fontSize);
        this.entity.addChild(textEntity);

        button.button.on('click', () => {
            button.element.color = pressedTint;
            clickCallback();
        });
    }
}