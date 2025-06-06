import { ContactRelationship, IContactRelationship } from '../models/ContactRelationship';
import { RelationshipType } from '../models/RelationshipType';
import mongoose from 'mongoose';

export class ContactRelationshipService {
    /**
     * Create a new contact relationship
     */
    async createContactRelationship(data: {
        fromContact: string;
        toContact: string;
        relationshipTypeId: string;
        createdBy: string;
    }): Promise<IContactRelationship> {
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
        const relationship = await ContactRelationship.create({
            fromContact: data.fromContact,
            toContact: data.toContact,
            relationshipTypeId: data.relationshipTypeId,
            createdBy: data.createdBy,
            fromContactAccepted: true,
            toContactAccepted: false
        });

        return relationship;
    }

    /**
     * Get relationship between two contacts
     */
    async getRelationship(fromContact: string, toContact: string): Promise<IContactRelationship | null> {
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
    async acceptRelationship(relationshipId: string, contactId: string): Promise<IContactRelationship> {
        const relationship = await ContactRelationship.findById(relationshipId);
        if (!relationship) {
            throw new Error('Relationship not found');
        }

        // Verify the contact is part of the relationship
        if (relationship.toContact.toString() !== contactId) {
            throw new Error('Unauthorized to accept this relationship');
        }

        relationship.toContactAccepted = true;
        // acceptedAt will be automatically set by the pre-save hook
        await relationship.save();

        return relationship;
    }

    /**
     * Reject or cancel a relationship
     */
    async rejectRelationship(relationshipId: string, contactId: string): Promise<void> {
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
    async updateRelationshipType(
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

        relationship.relationshipTypeId = new mongoose.Types.ObjectId(relationshipTypeId);
        await relationship.save();

        return relationship;
    }

    /**
     * Get all relationships for a contact
     */
    async getContactRelationships(
        contactId: string,
        filters?: {
            accepted?: boolean;
            pending?: boolean;
        }
    ): Promise<IContactRelationship[]> {
        const query: any = {
            $or: [
                { fromContact: contactId },
                { toContact: contactId }
            ]
        };

        if (filters?.accepted) {
            query.toContactAccepted = true;
        }
        if (filters?.pending) {
            query.toContactAccepted = false;
        }

        return ContactRelationship.find(query)
            .populate(['relationshipTypeId', 'fromContact', 'toContact', 'createdBy']);
    }

    /**
     * Get pending relationship requests for a contact
     */
    async getPendingRequests(contactId: string): Promise<IContactRelationship[]> {
        return ContactRelationship.find({
            toContact: contactId,
            toContactAccepted: false
        }).populate(['relationshipTypeId', 'fromContact', 'toContact', 'createdBy']);
    }
} 