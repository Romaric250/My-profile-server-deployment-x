import { RelationshipType, IRelationshipType, ProfileType } from '../models/RelationshipType';
import { ContactRelationship } from '../models/ContactRelationship';
import { FilterQuery, QueryOptions } from 'mongoose';

export class RelationshipTypeService {
    /**
     * Create a new relationship type
     */
    static async create(data: Partial<IRelationshipType>): Promise<IRelationshipType> {
        if (!data.name || !data.profileType || !data.inverseName) {
            throw new Error('Name, inverseName, and profileType are required');
        }

        const existing = await RelationshipType.findOne({
            name: data.name,
            profileType: data.profileType,
            isApproved: true,
        });

        if (existing) {
            throw new Error('Relationship type already exists');
        }

        return RelationshipType.create({
            ...data,
            isSystemDefined: data.isSystemDefined || false,
            isApproved: true
        });
    }

    /**
     * Find relationship types with filtering and pagination
     */
    static async find(
        filter: FilterQuery<IRelationshipType> = {},
        options: QueryOptions = {}
    ): Promise<IRelationshipType[]> {
        return RelationshipType.find(filter, null, options);
    }

    /**
     * Get a single relationship type by ID
     */
    static async findById(id: string): Promise<IRelationshipType | null> {
        return RelationshipType.findById(id);
    }

    /**
     * Update a relationship type
     */
    static async update(
        id: string,
        data: Partial<IRelationshipType>
    ): Promise<IRelationshipType | null> {
        const existing = await RelationshipType.findById(id);
        if (!existing) {
            throw new Error('Relationship type not found');
        }

        // Prevent changing system-defined relationships
        if (existing.isSystemDefined) {
            if (data.isSystemDefined === false || data.name || data.inverseName) {
                throw new Error('Cannot modify system-defined relationship types');
            }
        }

        // If name or profileType is being changed, check for duplicates
        if (data.name || data.profileType) {
            const duplicate = await RelationshipType.findOne({
                _id: { $ne: id },
                name: data.name || existing.name,
                profileType: data.profileType || existing.profileType,
                isApproved: true
            });

            if (duplicate) {
                throw new Error('A relationship type with this name and profile type already exists');
            }
        }

        return RelationshipType.findByIdAndUpdate(
            id,
            { $set: data },
            { new: true }
        );
    }

    /**
     * Delete a relationship type
     */
    static async delete(id: string): Promise<void> {
        const relationshipType = await RelationshipType.findById(id);
        if (!relationshipType) {
            throw new Error('Relationship type not found');
        }

        if (relationshipType.isSystemDefined) {
            throw new Error('Cannot delete system-defined relationship types');
        }

        // Check if there are any relationships using this type
        const hasRelationships = await ContactRelationship.exists({
            relationshipTypeId: id
        });

        if (hasRelationships) {
            throw new Error('Cannot delete relationship type that is in use');
        }

        await relationshipType.deleteOne();
    }

    /**
     * Search relationship types by name or description
     */
    static async search(query: string): Promise<IRelationshipType[]> {
        return RelationshipType.find({
            $or: [
                { name: { $regex: query, $options: 'i' } },
                { inverseName: { $regex: query, $options: 'i' } },
                { description: { $regex: query, $options: 'i' } }
            ],
            isApproved: true
        });
    }

    /**
     * Get relationship types by ProfileType
     */
    static async findByProfileType(
        profileType: ProfileType
    ): Promise<IRelationshipType[]> {
        return RelationshipType.find({ 
            profileType,
            isApproved: true 
        });
    }

    /**
     * Validate relationship type for use
     */
    static async validateForUse(id: string): Promise<IRelationshipType> {
        const relationshipType = await RelationshipType.findById(id);
        if (!relationshipType) {
            throw new Error('Relationship type not found');
        }

        if (!relationshipType.isApproved) {
            throw new Error('Relationship type is not approved');
        }

        return relationshipType;
    }

    /**
     * Bulk create relationship types
     */
    static async bulkCreate(
        items: Array<Partial<IRelationshipType>>,
        options: { skipDuplicates?: boolean } = { skipDuplicates: true }
    ): Promise<{
        created: number;
        duplicates: number;
        errors: Array<{ index: number; error: string }>;
    }> {
        const errors: Array<{ index: number; error: string }> = [];
        const duplicateNames = new Set<string>();
        const createdItems: IRelationshipType[] = [];

        // Validate and filter items
        const validItems = await Promise.all(
            items.map(async (item, index) => {
                try {
                    // Required fields check
                    if (!item.name || !item.profileType || !item.inverseName) {
                        throw new Error('Name, inverseName, and profileType are required');
                    }

                    // Validate profileType enum
                    if (!Object.values(ProfileType).includes(item.profileType as ProfileType)) {
                        throw new Error(`Invalid profileType: ${item.profileType}`);
                    }

                    // Check for duplicates
                    const key = `${item.name.toLowerCase()}_${item.profileType.toLowerCase()}`;
                    if (options.skipDuplicates) {
                        const exists = await RelationshipType.exists({
                            name: { $regex: new RegExp(`^${item.name}$`, 'i') },
                            profileType: item.profileType
                        });
                        if (exists) {
                            duplicateNames.add(key);
                            throw new Error('Duplicate relationship type');
                        }
                    }

                    item.isApproved = true; // Set default value
                    return item;
                } catch (error) {
                    errors.push({ index, error: (error as Error).message });
                    return null;
                }
            })
        );

        // Insert valid items
        const filteredItems = validItems.filter(Boolean) as Array<Partial<IRelationshipType>>;
        if (filteredItems.length > 0) {
            const result = await RelationshipType.insertMany(filteredItems, { ordered: false });
            createdItems.push(...result);
        }

        return {
            created: createdItems.length,
            duplicates: duplicateNames.size,
            errors,
        };
    }

    /**
     * Bulk Delete relationship types
     */
    static async bulkDelete(ids: string[]): Promise<{ deletedCount: number }> {
        // Check for system-defined types
        const systemTypes = await RelationshipType.find({
            _id: { $in: ids },
            isSystemDefined: true
        });

        if (systemTypes.length > 0) {
            throw new Error('Cannot delete system-defined relationship types');
        }

        // Check for types in use
        const usedTypes = await ContactRelationship.find({
            relationshipTypeId: { $in: ids }
        });

        if (usedTypes.length > 0) {
            throw new Error('Cannot delete relationship types that are in use');
        }

        const result = await RelationshipType.deleteMany({ 
            _id: { $in: ids },
            isSystemDefined: false
        });
        
        return { deletedCount: result.deletedCount };
    }
}