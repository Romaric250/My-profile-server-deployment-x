import { ContactRelationship, IContactRelationship } from '../models/ContactRelationship';
import { RelationshipType, IRelationshipType, ProfileType } from '../models/RelationshipType';
import { FilterQuery, QueryOptions, Types } from 'mongoose';

interface CreateContactRelationshipData {
    fromContact: string;
    toContact: string;
    relationshipTypeId: string;
    createdBy: string;
}

export class ContactRelationshipService {
    /**
     * Create a new relationship type
     */
    static async createRelationType(data: {
        name: string;
        inverseName: string;
        profileType: ProfileType;
        group?: string;
        description?: string;
        isSystemDefined?: boolean;
        tags?: string[];
    }): Promise<IRelationshipType> {
        const existing = await RelationshipType.findOne({
            name: data.name,
            profileType: data.profileType,
            isApproved: true
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
     * Update a relationship type
     */
    static async updateRelationType(
        id: string,
        data: Partial<IRelationshipType>
    ): Promise<IRelationshipType | null> {
        const existing = await RelationshipType.findById(id);
        if (!existing) {
            throw new Error('Relationship type not found');
        }

        if (existing.isSystemDefined && data.isSystemDefined === false) {
            throw new Error('Cannot modify system-defined status of relationship types');
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
    static async deleteRelationType(id: string): Promise<void> {
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
     * Get relationship types by profile type
     */
    static async getRelationTypesByProfile(profileType: ProfileType): Promise<IRelationshipType[]> {
        return RelationshipType.find({
            profileType,
            isApproved: true
        });
    }

    /**
     * Search relationship types
     */
    static async searchRelationTypes(query: string): Promise<IRelationshipType[]> {
        return RelationshipType.find({
            $and: [
                { isApproved: true },
                {
                    $or: [
                        { name: { $regex: query, $options: 'i' } },
                        { inverseName: { $regex: query, $options: 'i' } },
                        { description: { $regex: query, $options: 'i' } }
                    ]
                }
            ]
        });
    }

    /**
     * Create a new contact relationship
     */
    static async create(data: CreateContactRelationshipData): Promise<IContactRelationship> {
        const relationshipType = await RelationshipType.findById(data.relationshipTypeId);
        if (!relationshipType) {
            throw new Error('Relationship type not found');
        }

        // Check if relationship already exists
        const existingRelationship = await ContactRelationship.findOne({
            $or: [
                { fromContact: data.fromContact, toContact: data.toContact },
                { fromContact: data.toContact, toContact: data.fromContact }
            ]
        });

        if (existingRelationship) {
            throw new Error('Relationship already exists between these contacts');
        }

        // Create the relationship
        return ContactRelationship.create({
            fromContact: data.fromContact,
            toContact: data.toContact,
            relationshipTypeId: data.relationshipTypeId,
            createdBy: data.createdBy,
            fromContactAccepted: true,
            toContactAccepted: false,
            fromName: relationshipType.name,
            toName: relationshipType.inverseName
        });
    }

    /**
     * Find relationships with filtering and pagination
     */
    static async find(
        filter: FilterQuery<IContactRelationship> = {},
        options: QueryOptions = {}
    ): Promise<IContactRelationship[]> {
        return ContactRelationship.find(filter, null, options)
            .populate(['relationshipTypeId', 'fromContact', 'toContact', 'createdBy']);
    }

    /**
     * Get a single relationship by ID
     */
    static async findById(id: string): Promise<IContactRelationship | null> {
        return ContactRelationship.findById(id)
            .populate(['relationshipTypeId', 'fromContact', 'toContact', 'createdBy']);
    }

    /**
     * Get relationship between two contacts
     */
    static async findBetweenContacts(fromContact: string, toContact: string): Promise<IContactRelationship | null> {
        return ContactRelationship.findOne({
            $or: [
                { fromContact, toContact },
                { fromContact: toContact, toContact: fromContact }
            ]
        }).populate(['relationshipTypeId', 'fromContact', 'toContact', 'createdBy']);
    }

    /**
     * Accept a relationship request
     */
    static async accept(relationshipId: string, contactId: string): Promise<IContactRelationship> {
        const relationship = await ContactRelationship.findById(relationshipId);
        if (!relationship) {
            throw new Error('Relationship not found');
        }

        // Verify the contact is part of the relationship
        if (relationship.toContact.toString() !== contactId) {
            throw new Error('Unauthorized to accept this relationship');
        }

        relationship.toContactAccepted = true;
        await relationship.save();

        return relationship.populate(['relationshipTypeId', 'fromContact', 'toContact', 'createdBy']);
    }

    /**
     * Reject or cancel a relationship
     */
    static async reject(relationshipId: string, contactId: string): Promise<void> {
        const relationship = await ContactRelationship.findById(relationshipId);
        if (!relationship) {
            throw new Error('Relationship not found');
        }

        // Verify the contact is part of the relationship
        if (![relationship.fromContact.toString(), relationship.toContact.toString()].includes(contactId)) {
            throw new Error('Unauthorized to reject this relationship');
        }

        await relationship.deleteOne();
    }

    /**
     * Update relationship type
     */
    static async updateType(
        relationshipId: string,
        relationshipTypeId: string,
        contactId: string
    ): Promise<IContactRelationship> {
        const [relationship, relationshipType] = await Promise.all([
            ContactRelationship.findById(relationshipId),
            RelationshipType.findById(relationshipTypeId)
        ]);

        if (!relationship) {
            throw new Error('Relationship not found');
        }
        if (!relationshipType) {
            throw new Error('Relationship type not found');
        }

        // Verify the contact is part of the relationship
        if (![relationship.fromContact.toString(), relationship.toContact.toString()].includes(contactId)) {
            throw new Error('Unauthorized to update this relationship');
        }

        relationship.relationshipTypeId = new Types.ObjectId(relationshipTypeId);
        await relationship.save();

        return relationship.populate(['relationshipTypeId', 'fromContact', 'toContact', 'createdBy']);
    }

    /**
     * Get all relationships for a contact with filters
     */
    static async findForContact(
        contactId: string,
        filter: FilterQuery<IContactRelationship> = {},
        options: QueryOptions = {}
    ): Promise<IContactRelationship[]> {
        const baseQuery = {
            $or: [
                { fromContact: contactId },
                { toContact: contactId }
            ],
            ...filter
        };

        return ContactRelationship.find(baseQuery, null, options)
            .populate(['relationshipTypeId', 'fromContact', 'toContact', 'createdBy']);
    }

    /**
     * Get pending relationship requests for a contact
     */
    static async findPendingRequests(
        contactId: string,
        options: QueryOptions = {}
    ): Promise<IContactRelationship[]> {
        return ContactRelationship.find({
            toContact: contactId,
            toContactAccepted: false
        }, null, options).populate(['relationshipTypeId', 'fromContact', 'toContact', 'createdBy']);
    }

    /**
     * Bulk delete relationships
     */
    static async bulkDelete(ids: string[]): Promise<{ deletedCount: number }> {
        const result = await ContactRelationship.deleteMany({ _id: { $in: ids } });
        return { deletedCount: result.deletedCount };
    }

    /**
     * Search relationships by name
     */
    static async search(query: string): Promise<IContactRelationship[]> {
        return ContactRelationship.find({
            $or: [
                { fromName: { $regex: query, $options: 'i' } },
                { toName: { $regex: query, $options: 'i' } }
            ]
        }).populate(['relationshipTypeId', 'fromContact', 'toContact', 'createdBy']);
    }
} 