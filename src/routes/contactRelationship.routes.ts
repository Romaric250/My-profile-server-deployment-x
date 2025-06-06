import { Router } from 'express';
import { ContactRelationshipController } from '../controllers/contactRelationship.controller';


const router = Router();
const controller = new ContactRelationshipController();



// Create a new relationship
router.post('/', controller.createRelationship);

router.post('/type', controller.createRelationshipType);
router.put('/type/:relationshipId', controller.newUpdateRelationshipType);
router.delete('/type/:relationshipId', controller.deleteRelationshipType);

// Accept a relationship request
router.put('/:relationshipId/accept', controller.acceptRelationship);

// Reject a relationship request
router.delete('/:relationshipId/reject', controller.rejectRelationship);

// Update relationship type
router.put('/:relationshipId/type', controller.updateRelationshipType);

// Get all relationships for authenticated user
router.get('/my-relationships', controller.getMyRelationships);

// Get pending requests
router.get('/pending-requests', controller.getPendingRequests);

// Get specific relationship
router.get('/:fromContact/:toContact', controller.getRelationship);

export default router; 