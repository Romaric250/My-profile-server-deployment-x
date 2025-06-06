import { Request, Response } from 'express';
import { ContactRelationshipService } from '../services/contactRelationship.service';
import mongoose from 'mongoose';

export class ContactRelationshipController {
    private relationshipService: ContactRelationshipService;

    constructor() {
        this.relationshipService = new ContactRelationshipService();
    }

    /**
     * Create a new contact relationship
     */
    async createRelationship = async (req: Request, res: Response): Promise<void> => {
        try {
            const { fromContact, toContact, relationshipTypeId, fromName, toName } = req.body;

            // Validate required fields
            if (!fromContact || !toContact || !relationshipTypeId || !fromName || !toName) {
                res.status(400).json({
                    success: false,
                    message: 'Missing required fields'
                });
                return;
            }

            // Validate ObjectId format
            if (!mongoose.Types.ObjectId.isValid(fromContact) ||
                !mongoose.Types.ObjectId.isValid(toContact) ||
                !mongoose.Types.ObjectId.isValid(relationshipTypeId)) {
                res.status(400).json({
                    success: false,
                    message: 'Invalid ID format'
                });
                return;
            }

            const relationship = await this.relationshipService.createContactRelationship({
                fromContact,
                toContact,
                relationshipTypeId,
                createdBy: req.user._id, // Assuming user is attached to request by auth middleware
                fromName,
                toName
            });

            res.status(201).json({
                success: true,
                data: relationship
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                message: error instanceof Error ? error.message : 'Failed to create relationship'
            });
        }
    };

    /**
     * Accept a relationship request
     */
    async acceptRelationship = async (req: Request, res: Response): Promise<void> => {
        try {
            const { relationshipId } = req.params;

            if (!mongoose.Types.ObjectId.isValid(relationshipId)) {
                res.status(400).json({
                    success: false,
                    message: 'Invalid relationship ID'
                });
                return;
            }

            const relationship = await this.relationshipService.acceptRelationship(
                relationshipId,
                req.user._id // Assuming user is attached to request by auth middleware
            );

            res.status(200).json({
                success: true,
                data: relationship
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                message: error instanceof Error ? error.message : 'Failed to accept relationship'
            });
        }
    };

    /**
     * Reject or cancel a relationship
     */
    async rejectRelationship = async (req: Request, res: Response): Promise<void> => {
        try {
            const { relationshipId } = req.params;

            if (!mongoose.Types.ObjectId.isValid(relationshipId)) {
                res.status(400).json({
                    success: false,
                    message: 'Invalid relationship ID'
                });
                return;
            }

            await this.relationshipService.rejectRelationship(
                relationshipId,
                req.user._id // Assuming user is attached to request by auth middleware
            );

            res.status(200).json({
                success: true,
                message: 'Relationship rejected successfully'
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                message: error instanceof Error ? error.message : 'Failed to reject relationship'
            });
        }
    };

    /**
     * Update relationship type
     */
    async updateRelationshipType = async (req: Request, res: Response): Promise<void> => {
        try {
            const { relationshipId } = req.params;
            const { relationshipTypeId } = req.body;

            if (!mongoose.Types.ObjectId.isValid(relationshipId) ||
                !mongoose.Types.ObjectId.isValid(relationshipTypeId)) {
                res.status(400).json({
                    success: false,
                    message: 'Invalid ID format'
                });
                return;
            }

            const relationship = await this.relationshipService.updateRelationshipType(
                relationshipId,
                relationshipTypeId,
                req.user._id // Assuming user is attached to request by auth middleware
            );

            res.status(200).json({
                success: true,
                data: relationship
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                message: error instanceof Error ? error.message : 'Failed to update relationship type'
            });
        }
    };

    /**
     * Get all relationships for the authenticated user
     */
    async getMyRelationships = async (req: Request, res: Response): Promise<void> => {
        try {
            const { accepted, pending } = req.query;
            
            const relationships = await this.relationshipService.getContactRelationships(
                req.user._id, // Assuming user is attached to request by auth middleware
                {
                    accepted: accepted === 'true',
                    pending: pending === 'true'
                }
            );

            res.status(200).json({
                success: true,
                data: relationships
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                message: error instanceof Error ? error.message : 'Failed to fetch relationships'
            });
        }
    };

    /**
     * Get pending relationship requests for the authenticated user
     */
    async getPendingRequests = async (req: Request, res: Response): Promise<void> => {
        try {
            const requests = await this.relationshipService.getPendingRequests(req.user._id);

            res.status(200).json({
                success: true,
                data: requests
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                message: error instanceof Error ? error.message : 'Failed to fetch pending requests'
            });
        }
    };

    /**
     * Get a specific relationship
     */
    async getRelationship = async (req: Request, res: Response): Promise<void> => {
        try {
            const { fromContact, toContact } = req.params;

            if (!mongoose.Types.ObjectId.isValid(fromContact) ||
                !mongoose.Types.ObjectId.isValid(toContact)) {
                res.status(400).json({
                    success: false,
                    message: 'Invalid contact ID format'
                });
                return;
            }

            const relationship = await this.relationshipService.getRelationship(fromContact, toContact);

            if (!relationship) {
                res.status(404).json({
                    success: false,
                    message: 'Relationship not found'
                });
                return;
            }

            res.status(200).json({
                success: true,
                data: relationship
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                message: error instanceof Error ? error.message : 'Failed to fetch relationship'
            });
        }
    };
} 