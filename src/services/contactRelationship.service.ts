import { ContactRelationship, IContactRelationship } from '../models/ContactRelationship';
import { RelationshipType, ProfileType } from '../models/RelationshipType';

export class ContactRelationshipService {
    /**
     * Create a new contact relationship
     */
    async createContactRelationship(data: {
        fromContactId: string;
        toContactId: string;
        relationshipTypeId: string;
        notes?: string;
    }): Promise<IContactRelationship> {
        // Validate relationship type exists
        const relationshipType = await RelationshipType.findById(data.relationshipTypeId);
        if (!relationshipType) {
            throw new Error('Relationship type not found');
        }

        // Check if relationship already exists
        const existingRelationship = await ContactRelationship.findOne({
            $or: [
                { fromContactId: data.fromContactId },
                { toContactId: data.toContactId }
            ]
        });

        if (existingRelationship) {
            throw new Error('Relationship already exists between these contacts');
        }

        // Create the relationship
        const relationship = await ContactRelationship.create({
            fromContactId: data.fromContactId,
            toContactId: data.toContactId,
            relationshipTypeId: data.relationshipTypeId,
            notes: data.notes
        });

        return relationship;
    }

    /**
     * Get relationship between two contacts
     */
    async getRelationship(fromContactId: string, toContactId: string): Promise<IContactRelationship | null> {
        return ContactRelationship.findOne({
            fromContactId,
            toContactId
        }).populate('relationshipTypeId');
    }

    /**
     * Update an existing relationship
     */
    async updateRelationship(
        relationshipId: string,
        data: {
            relationshipTypeId?: string;
            notes?: string;
        }
    ): Promise<IContactRelationship> {
        const relationship = await ContactRelationship.findById(relationshipId);
        if (!relationship) {
            throw new Error('Relationship not found');
        }

        if (data.relationshipTypeId) {
            const relationshipType = await RelationshipType.findById(data.relationshipTypeId);
            if (!relationshipType) {
                throw new Error('Relationship type not found');
            }
            relationship.relationshipTypeId = data.relationshipTypeId;
        }

        if (data.notes !== undefined) {
            relationship.notes = data.notes;
        }

        await relationship.save();
        return relationship;
    }

    /**
     * Delete a relationship
     */
    async deleteRelationship(relationshipId: string): Promise<void> {
        const relationship = await ContactRelationship.findById(relationshipId);
        if (!relationship) {
            throw new Error('Relationship not found');
        }

        await relationship.deleteOne();
    }

    /**
     * Get all relationships for a contact
     */
    async getContactRelationships(contactId: string): Promise<IContactRelationship[]> {
        return ContactRelationship.find({
            $or: [
                { fromContactId: contactId },
                { toContactId: contactId }
            ]
        }).populate('relationshipTypeId');
    }
} 