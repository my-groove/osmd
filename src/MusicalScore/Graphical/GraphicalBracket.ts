import {GraphicalObject} from "./GraphicalObject";
import {BoundingBox} from "./BoundingBox";
import {BracketExpression} from "../VoiceData/Expressions/ContinuousExpressions/BracketExpression";

/**
 * The graphical counterpart of a [[BracketExpression]] (e.g. palm muting "P.M." with dashed line).
 */
export class GraphicalBracket extends GraphicalObject {
    constructor(bracket: BracketExpression, parent: BoundingBox) {
        super();
        this.bracket = bracket;
        this.PositionAndShape = new BoundingBox(this, parent);
    }

    public bracket: BracketExpression;
    /** Whether this part of the bracket continues on the next staffline. */
    public endsOnDifferentStaffLine: boolean = false;
    /** Whether this part is a continuation of a bracket started on a previous staffline. The label is only drawn at the start. */
    public isContinuation: boolean = false;
}
