import { mongoose, Schema } from './index.js';

/**
 * Create a model with common configurations
 * @param {string} name - Model name
 * @param {object} schemaDefinition - Schema fields definition
 * @param {object} options - Schema options
 * @returns {mongoose.Model}
 * 
 * @example
 * const User = createModel('User', {
 *     name: { type: String, required: true },
 *     email: { type: String, required: true, unique: true },
 *     age: Number
 * });
 */
export function createModel(name, schemaDefinition, options = {}) {
    // Check if model already exists to avoid OverwriteModelError
    if (mongoose.models[name]) {
        return mongoose.models[name];
    }

    const defaultOptions = {
        timestamps: true,      // adds createdAt and updatedAt
        versionKey: '__v',     // version key
        toJSON: {
            virtuals: true,
            transform: (doc, ret) => {
                ret.id = ret._id;
                delete ret._id;
                delete ret.__v;
                return ret;
            }
        },
        toObject: {
            virtuals: true
        }
    };

    const schema = new Schema(schemaDefinition, { ...defaultOptions, ...options });
    
    return mongoose.model(name, schema);
}

/**
 * Create a model with custom schema instance
 * Use this when you need to add methods, statics, virtuals, or hooks
 * @param {string} name - Model name
 * @param {mongoose.Schema} schema - Pre-configured schema instance
 * @returns {mongoose.Model}
 * 
 * @example
 * const userSchema = new Schema({ name: String });
 * userSchema.methods.greet = function() { return `Hello, ${this.name}`; };
 * const User = createModelFromSchema('User', userSchema);
 */
export function createModelFromSchema(name, schema) {
    if (mongoose.models[name]) {
        return mongoose.models[name];
    }
    
    return mongoose.model(name, schema);
}

export default { createModel, createModelFromSchema };
