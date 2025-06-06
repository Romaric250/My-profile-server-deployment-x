import { Request, Response } from 'express';
import { ContactRelationshipService } from '../services/contactRelationship.service';
import mongoose from 'mongoose';
import createHttpError from 'http-errors';
import { RelationshipType } from '../models/RelationshipType';
import { User } from '../models/User';


export class ContactRelationshipController {
    private relationshipService: ContactRelationshipService;

    constructor() {
        this.relationshipService = new ContactRelationshipService();
    }

    /**
     * Create a new contact relationship
     */
    createRelationship = async (req: Request, res: Response): Promise<void> => {
        try {
            const userId = (req.user as any)?._id;
            const usercontact = (req.user as any)?.phoneNumber;

            if (!userId || !usercontact) throw createHttpError(401, 'Unauthorized');
            const { toContact, relationshipTypeId } = req.body;

            // Validate required fields
            if ( !toContact || !relationshipTypeId) {
                res.status(400).json({
                    success: false,
                    message: 'Missing required fields'
                });
                
            }

            // Validate ObjectId format
            if (!mongoose.Types.ObjectId.isValid(relationshipTypeId)) {
                res.status(400).json({
                    success: false,
                    message: 'Invalid ID format'
                });
                

            }

            const toContactexist = await User.findOne({phoneNumber: toContact});
            if (!toContactexist) {
                res.status(400).json({
                    success: false,
                    message: 'Contact you want to connect to is not found'
                });
            }
            


            const relationship = await ContactRelationshipService.create({
                fromContact: usercontact,
                toContact,
                relationshipTypeId,
                createdBy: userId
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
    acceptRelationship = async (req: Request, res: Response): Promise<void> => {
        try {
            const { relationshipId } = req.params;
            const userId = (req.user as any)?._id;
            if (!userId) throw createHttpError(401, 'Unauthorized');

            if (!mongoose.Types.ObjectId.isValid(relationshipId)) {
                res.status(400).json({
                    success: false,
                    message: 'Invalid relationship ID'
                });
                return;
            }

            const relationship = await ContactRelationshipService.accept(
                relationshipId,
                userId
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
    rejectRelationship = async (req: Request, res: Response): Promise<void> => {
        try {
            const { relationshipId } = req.params;
            const userId = (req.user as any)?._id;
            if (!userId) throw createHttpError(401, 'Unauthorized');

            if (!mongoose.Types.ObjectId.isValid(relationshipId)) {
                res.status(400).json({
                    success: false,
                    message: 'Invalid relationship ID'
                });
                return;
            }

            await ContactRelationshipService.reject(
                relationshipId,
                userId
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
    updateRelationshipType = async (req: Request, res: Response): Promise<void> => {
        try {
            const { relationshipId } = req.params;
            const { relationshipTypeId } = req.body;
            const userId = (req.user as any)?._id;
            if (!userId) throw createHttpError(401, 'Unauthorized');

            if (!mongoose.Types.ObjectId.isValid(relationshipId) ||
                !mongoose.Types.ObjectId.isValid(relationshipTypeId)) {
                res.status(400).json({
                    success: false,
                    message: 'Invalid ID format'
                });
                return;
            }

            const relationship = await ContactRelationshipService.updateType(
                relationshipId,
                relationshipTypeId,
                userId
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
    getMyRelationships = async (req: Request, res: Response): Promise<void> => {
        try {
            const { accepted, pending } = req.query;
            const userId = (req.user as any)?._id;
            if (!userId) throw createHttpError(401, 'Unauthorized');

            const filter = {
                ...(accepted === 'true' && { toContactAccepted: true }),
                ...(pending === 'true' && { toContactAccepted: false })
            };

            const relationships = await ContactRelationshipService.findForContact(userId, filter);

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
    getPendingRequests = async (req: Request, res: Response): Promise<void> => {
        try {
            const userId = (req.user as any)?._id;
            if (!userId) throw createHttpError(401, 'Unauthorized');
            const requests = await ContactRelationshipService.findPendingRequests(userId);

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
    getRelationship = async (req: Request, res: Response): Promise<void> => {
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

            const relationship = await ContactRelationshipService.findBetweenContacts(fromContact, toContact);

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


createRelationshipType = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = (req.user as any)?._id;
        if (!userId) throw createHttpError(401, 'Unauthorized');
        const { name, inverseName, profileType } = req.body;
        const relationshipType = await RelationshipType.create({
            name,
            inverseName,
            profileType
        });
        res.status(201).json({
            success: true,
            data: relationshipType
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error instanceof Error ? error.message : 'Failed to create relationship type'
        });
    }
};

newUpdateRelationshipType = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = (req.user as any)?._id;
        if (!userId) throw createHttpError(401, 'Unauthorized');
        const { relationshipId } = req.params;
        const { name, inverseName, profileType } = req.body;
        const relationshipType = await RelationshipType.findByIdAndUpdate(relationshipId, { name, inverseName, profileType });
        res.status(200).json({
            success: true,
            data: relationshipType
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error instanceof Error ? error.message : 'Failed to update relationship type'
        });
    }
}

deleteRelationshipType = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = (req.user as any)?._id;
        if (!userId) throw createHttpError(401, 'Unauthorized');
        const { relationshipId } = req.params;
        const relationshipType = await RelationshipType.findByIdAndDelete(relationshipId);
        res.status(200).json({
            success: true,
            data: relationshipType
        }); 
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error instanceof Error ? error.message : 'Failed to delete relationship type'
        });
    }
}





} 